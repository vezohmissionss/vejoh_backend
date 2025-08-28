const express = require("express")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const twilio = require("twilio")
const nodemailer = require("nodemailer")
const User = require("../models/user")
const Driver = require("../models/driver")
const { auth } = require("../middleware/auth")
const { generateOTP, formatPhoneNumber, isValidEmail, isValidPhone } = require("../utils/helpers")
const { sendEmailVerificationOTP, sendPasswordResetOTP } = require("../utils/emailService")

const router = express.Router()

let twilioClient = null

const initializeTwilio = () => {
  if (
    !twilioClient &&
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_ACCOUNT_SID.startsWith("AC") &&
    process.env.TWILIO_ACCOUNT_SID !== "your_twilio_sid"
  ) {
    try {
      twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
      console.log("Twilio client initialized successfully")
    } catch (error) {
      console.error("Failed to initialize Twilio client:", error.message)
      twilioClient = null
    }
  }
  return twilioClient
}

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  })
}


router.post("/register/user", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body

    // Validation
    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      })
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      })
    }

    if (!isValidPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid phone number",
      })
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      })
    }

    const formattedPhone = formatPhoneNumber(phone)

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { phone: formattedPhone }],
    })

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists with this email or phone number",
      })
    }

    // Hash password
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    // Generate OTP
    const otp = generateOTP()

    // Create user
    const user = new User({
      name: name.trim(),
      email: email.toLowerCase(),
      phone: formattedPhone,
      password: hashedPassword,
      verificationCode: otp,
    })

    await user.save()

    const emailSent = await sendEmailVerificationOTP(user.email, otp, user.name)

    if (!emailSent) {
      console.log(`[WARNING] Email failed to send, but user created. OTP: ${otp}`)
    }

    // Generate token
    const token = generateToken(user._id, "user")

    res.status(201).json({
      success: true,
      message: emailSent
        ? "User registered successfully. Please check your email for the verification code."
        : "User registered successfully. Please check server logs for the verification code.",
      id: user._id,
      role: "user",
      token: token,
    })
  } catch (error) {
    console.error("User registration error:", error)
    res.status(500).json({
      success: false,
      message: "Server error during registration",
    })
  }
})


router.post("/register/driver", async (req, res) => {
  try {
    const { name, email, phone, password } = req.body

    // Validation - exactly same as user registration
    if (!name || !email || !phone || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields",
      })
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      })
    }

    if (!isValidPhone(phone)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid phone number",
      })
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      })
    }

    const formattedPhone = formatPhoneNumber(phone)

    // Check if driver already exists
    const existingDriver = await Driver.findOne({
      $or: [{ email: email.toLowerCase() }, { phone: formattedPhone }],
    })

    if (existingDriver) {
      return res.status(400).json({
        success: false,
        message: "Driver already exists with this email or phone number",
      })
    }

    // Hash password
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(password, salt)

    // Generate OTP for email verification
    const otp = generateOTP()

    const driver = new Driver({
      name: name.trim(),
      email: email.toLowerCase(),
      phone: formattedPhone,
      password: hashedPassword,
      verificationCode: otp,
      otpExpiry: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes expiry
    })

    await driver.save()

    const emailSent = await sendEmailVerificationOTP(driver.email, otp, driver.name)

    if (!emailSent) {
      console.log(`[WARNING] Email failed to send, but driver created. OTP: ${otp}`)
    }

    // Generate token
    const token = generateToken(driver._id, "driver")

    res.status(201).json({
      success: true,
      message: emailSent
        ? "Driver registered successfully. Please check your email for the verification code."
        : "Driver registered successfully. Please check server logs for the verification code.",
      id: driver._id,
      role: "driver",
      token: token,
    })
  } catch (error) {
    console.error("Driver registration error:", error)
    res.status(500).json({
      success: false,
      message: "Server error during registration",
    })
  }
})


router.post("/verify-email-otp", auth, async (req, res) => {
  try {
    const { email, otp } = req.body
    const role = req.role // Extract role from JWT token via auth middleware

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Please provide email and OTP",
      })
    }

    const Model = role === "user" ? User : Driver
    const user = await Model.findById(req.user._id)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    if (user.email.toLowerCase() !== email.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: "Email does not match the authenticated user",
      })
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified",
      })
    }

    console.log("[DEBUG] OTP Verification:")
    console.log("[DEBUG] Email:", email)
    console.log("[DEBUG] Provided OTP:", otp)
    console.log("[DEBUG] Stored OTP:", user.verificationCode)
    console.log("[DEBUG] OTP Expiry:", user.otpExpiry)
    console.log("[DEBUG] Current Time:", new Date())

    if (user.verificationCode !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      })
    }

    if (user.otpExpiry && new Date() > user.otpExpiry) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      })
    }

    user.isVerified = true
    user.verificationCode = null
    user.otpExpiry = null
    await user.save()

    const token = generateToken(user._id, role)

    console.log("[SUCCESS] Email verification successful for:", email)

    res.json({
      success: true,
      message: "Email verified successfully",
      id: user._id,
      role: role,
      isVerified: true,
      token: token,
    })
  } catch (error) {
    console.error("Email OTP verification error:", error)
    res.status(500).json({
      success: false,
      message: "Server error during email verification",
    })
  }
})


router.post("/resend-email-otp", auth, async (req, res) => {
  try {
    const { email } = req.body
    const role = req.role // Extract role from JWT token via auth middleware

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Please provide email",
      })
    }

    const Model = role === "user" ? User : Driver
    const user = await Model.findById(req.user._id)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    if (user.email.toLowerCase() !== email.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: "Email does not match the authenticated user",
      })
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified",
      })
    }

    // Generate new OTP
    const otp = generateOTP()
    user.verificationCode = otp
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes expiry
    await user.save()

    const emailSent = await sendEmailVerificationOTP(user.email, otp, user.name)

    res.json({
      success: true,
      message: emailSent ? "OTP sent successfully to your email" : "OTP generated. Please check server logs.",
    })
  } catch (error) {
    console.error("Resend email OTP error:", error)
    res.status(500).json({
      success: false,
      message: "Server error while sending OTP",
    })
  }
})


router.post("/login/user", async (req, res) => {
  try {
    const { identifier, password } = req.body

    // Validation
    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email/phone and password",
      })
    }

    // Find user by email or phone
    const user = await User.findOne({
      $or: [{ email: identifier.toLowerCase() }, { phone: formatPhoneNumber(identifier) }],
    })

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      })
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      })
    }

    // Check if user is active
    if (user.status !== "active") {
      return res.status(400).json({
        success: false,
        message: "Account is suspended. Please contact support.",
      })
    }

    // Generate token
    const token = generateToken(user._id, "user")

    res.json({
      success: true,
      message: "Login successful",
      id: user._id,
      role: "user",
      token: token,
    })
  } catch (error) {
    console.error("User login error:", error)
    res.status(500).json({
      success: false,
      message: "Server error during login",
    })
  }
})


router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Please provide email address",
      })
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      })
    }

    let user = null
    let foundUserType = null

    user = await User.findOne({ email: email.toLowerCase() })
    if (user) {
      foundUserType = "user"
    } else {
      user = await Driver.findOne({ email: email.toLowerCase() })
      if (user) {
        foundUserType = "driver"
      }
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found with this email address",
      })
    }

    // Generate OTP for password reset
    const otp = generateOTP()
    user.verificationCode = otp
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes expiry
    await user.save()

    await sendPasswordResetOTP(user.email, otp, user.name)

    res.json({
      success: true,
      message: "Password reset OTP sent to your email address",
      data: {
        email: user.email.replace(/(.{2})(.*)(@.*)/, "$1***$3"), // Mask email
        role: foundUserType,
      },
    })
  } catch (error) {
    console.error("Forgot password error:", error)
    res.status(500).json({
      success: false,
      message: "Server error while processing request",
    })
  }
})


router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide email, OTP, and new password",
      })
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      })
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      })
    }

    let user = null
    let role = null

    // Check User collection first
    user = await User.findOne({ email: email.toLowerCase() })
    if (user) {
      role = "user"
    } else {
      // Check Driver collection
      user = await Driver.findOne({ email: email.toLowerCase() })
      if (user) {
        role = "driver"
      }
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    if (user.verificationCode !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      })
    }

    if (user.otpExpiry && new Date() > user.otpExpiry) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      })
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(newPassword, salt)

    // Update password and clear OTP
    user.password = hashedPassword
    user.verificationCode = null
    user.otpExpiry = null
    await user.save()

    res.json({
      success: true,
      message: "Password reset successfully",
      role: role, // Return detected user type for frontend reference
    })
  } catch (error) {
    console.error("Reset password error:", error)
    res.status(500).json({
      success: false,
      message: "Server error while resetting password",
    })
  }
})


router.post("/change-password", auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide current and new password",
      })
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters long",
      })
    }

    const Model = req.role === "user" ? User : Driver
    const user = await Model.findById(req.user._id)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    // Check current password
    const isMatch = await bcrypt.compare(currentPassword, user.password)
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      })
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(newPassword, salt)

    // Update password
    user.password = hashedPassword
    await user.save()

    res.json({
      success: true,
      message: "Password changed successfully",
    })
  } catch (error) {
    console.error("Change password error:", error)
    res.status(500).json({
      success: false,
      message: "Server error while changing password",
    })
  }
})


router.post("/login/driver", async (req, res) => {
  try {
    const { identifier, password } = req.body

    // Validation
    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide email/phone and password",
      })
    }

    // Find driver by email or phone
    const driver = await Driver.findOne({
      $or: [{ email: identifier.toLowerCase() }, { phone: formatPhoneNumber(identifier) }],
    })

    if (!driver) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      })
    }

    // Check password
    const isMatch = await bcrypt.compare(password, driver.password)
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Invalid credentials",
      })
    }

    // Generate token
    const token = generateToken(driver._id, "driver")

    res.json({
      success: true,
      message: "Login successful",
      id: driver._id,
      role: "driver",
      token: token,
    })
  } catch (error) {
    console.error("Driver login error:", error)
    res.status(500).json({
      success: false,
      message: "Server error during login",
    })
  }
})


router.get("/profile", auth, async (req, res) => {
  try {
    const Model = req.role === "user" ? User : Driver
    const user = await Model.findById(req.user._id).select("-password -verificationCode")

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      })
    }

    res.json({
      success: true,
      data: {
        [req.role]: user,
       // role: req.role,
      },
    })
  } catch (error) {
    console.error("Get user info error:", error)
    res.status(500).json({
      success: false,
      message: "Server error while fetching user info",
    })
  }
})


router.post("/logout", auth, async (req, res) => {
  try {
    res.json({
      success: true,
      message: "Logged out successfully",
    })
  } catch (error) {
    console.error("Logout error:", error)
    res.status(500).json({
      success: false,
      message: "Server error during logout",
    })
  }
})

module.exports = router

