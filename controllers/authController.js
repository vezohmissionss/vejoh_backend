const jwt = require("jsonwebtoken")
const twilio = require("twilio")
const User = require("../models/user")
const Driver = require("../models/driver")
const { generateOTP, formatPhoneNumber, isValidEmail, isValidPhone } = require("../utils/helpers")
const { sendEmailVerificationOTP } = require("../utils/emailService")

let twilioClient = null

// Initialize Twilio client
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
    } catch (error) {
      twilioClient = null
    }
  }
  return twilioClient
}

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: "30d" })
}

// Register User
exports.registerUser = async (req, res) => {
  try {
    const { name, email, phone } = req.body
    if (!name || !email || !phone) return res.status(400).json({ success: false, message: "Please provide all required fields" })
    if (!isValidEmail(email)) return res.status(400).json({ success: false, message: "Please provide a valid email address" })
    if (!isValidPhone(phone)) return res.status(400).json({ success: false, message: "Please provide a valid phone number" })

    const formattedPhone = formatPhoneNumber(phone)
    const existingUser = await User.findOne({ $or: [{ email: email.toLowerCase() }, { phone: formattedPhone }] })
    if (existingUser) return res.status(400).json({ success: false, message: "User already exists with this email or phone number" })

    const otp = generateOTP()
    const user = new User({ name: name.trim(), email: email.toLowerCase(), phone: formattedPhone, verificationCode: otp })
    await user.save()

    await sendEmailVerificationOTP(user.email, otp, user.name)

    const token = generateToken(user._id, "user")
    res.status(201).json({
      success: true,
      message: "User registered successfully. Please check your email for the verification code.",
      data: { id: user._id.toString(), token: token },
    })
  } catch {
    res.status(500).json({ success: false, message: "Server error during registration" })
  }
}

// Register Driver
exports.registerDriverComplete = async (req, res) => {
  try {


    const { name, email, phone } = req.body
    
    // Step 2: Validate basic required fields
    if (!name || !email || !phone) {
      return res.status(400).json({ 
        success: false, 
        message: "Please provide all required fields (name, email, phone)" 
      })
    }
    
    if (!isValidEmail(email)) {
      return res.status(400).json({ 
        success: false, 
        message: "Please provide a valid email address" 
      })
    }
    
    if (!isValidPhone(phone)) {
      return res.status(400).json({ 
        success: false, 
        message: "Please provide a valid phone number" 
      })
    }

    // Step 3: Check for existing driver
    const formattedPhone = formatPhoneNumber(phone)
    const existingDriver = await Driver.findOne({ 
      $or: [{ email: email.toLowerCase() }, { phone: formattedPhone }] 
    })
    
    if (existingDriver) {
      return res.status(400).json({ 
        success: false, 
        message: "Driver already exists with this email or phone number" 
      })
    }

    // Step 4: Parse and validate services
    let services;
    try {
      services = typeof req.body.services === 'string'
        ? JSON.parse(req.body.services)
        : req.body.services;
      if (!Array.isArray(services) || services.length === 0) {
        throw new Error('Services must be a non-empty array');
      }
    } catch {
      return res.status(400).json({
        success: false,
        message: 'Invalid services format. Should be a non-empty JSON array.'
      });
    }

    // Step 5: Validate vehicle information
    const requiredVehicleFields = ['vehicleType', 'vehicleMake', 'vehicleModel', 'vehicleColor', 'plateNumber'];
    const missingVehicleFields = requiredVehicleFields.filter(field => !req.body[field]);
    
    if (missingVehicleFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required vehicle information',
        missingFields: missingVehicleFields
      });
    }

    // Step 6: Validate required documents
    const requiredDocumentFields = [
      'drivingLicenseNumber', 'vehicleRegistrationNumber', 
      'insuranceNumber', 'aadharNumber'
    ];
    const missingDocumentFields = requiredDocumentFields.filter(field => !req.body[field]);
    
    if (missingDocumentFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required document information',
        missingFields: missingDocumentFields
      });
    }

    // Step 7: Check required document uploads
    const requiredFiles = [
      'drivingLicenseFront', 'drivingLicenseBack', 
      'vehicleRegistrationImage', 'insuranceImage',
      'aadharFront', 'aadharBack'
    ];
    const missingFiles = requiredFiles.filter(field => !req.files?.[field]);
    
    if (missingFiles.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Missing required document images',
        missingFiles
      });
    }

    // Step 8: Validate and check plate number uniqueness
    const plateNumber = req.body.plateNumber.toUpperCase();
    const existingPlate = await Driver.findOne({ 
      'vehicle.plateNumber': plateNumber
    });
    
    if (existingPlate) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle with this plate number is already registered'
      });
    }

    // Step 9: Generate OTP for email verification
    const otp = generateOTP()

    // Step 10: Create complete driver profile
    const driverData = {
      // Basic info (Page 1)
      name: name.trim(),
      email: email.toLowerCase(),
      phone: formattedPhone,
      verificationCode: otp,
      otpExpiry: new Date(Date.now() + 10 * 60 * 1000),
      
      // Services (Page 2)
      services,
      
      // Vehicle info (Page 3)
      vehicle: {
        type: req.body.vehicleType,
        make: req.body.vehicleMake,
        model: req.body.vehicleModel,
        year: req.body.vehicleYear ? parseInt(req.body.vehicleYear) : undefined,
        color: req.body.vehicleColor,
        plateNumber,
        capacity: {
          passengers: req.body.passengerCapacity ? parseInt(req.body.passengerCapacity) : undefined,
          weight: req.body.weightCapacity ? parseInt(req.body.weightCapacity) : undefined
        }
      },
      
      // Documents (Page 4)
      documents: {
        drivingLicense: {
          number: req.body.drivingLicenseNumber,
          frontImage: req.files.drivingLicenseFront[0].path,
          backImage: req.files.drivingLicenseBack[0].path,
          expiryDate: req.body.drivingLicenseExpiry ? new Date(req.body.drivingLicenseExpiry) : null,
          isVerified: false
        },
        vehicleRegistration: {
          number: req.body.vehicleRegistrationNumber,
          image: req.files.vehicleRegistrationImage[0].path,
          expiryDate: req.body.vehicleRegistrationExpiry ? new Date(req.body.vehicleRegistrationExpiry) : null,
          isVerified: false
        },
        insurance: {
          number: req.body.insuranceNumber,
          image: req.files.insuranceImage[0].path,
          expiryDate: req.body.insuranceExpiry ? new Date(req.body.insuranceExpiry) : null,
          isVerified: false
        },
        aadhar: {
          number: req.body.aadharNumber,
          frontImage: req.files.aadharFront[0].path,
          backImage: req.files.aadharBack[0].path,
          isVerified: false
        }
      },
      
      // Registration status
      verificationStatus: 'under_review',
      registrationStep: 'completed',
      isVerified: false // Email verification pending
    }

    // Step 11: Create driver
    const driver = new Driver(driverData)
    await driver.save()

    // Step 12: Send email verification OTP
    await sendEmailVerificationOTP(driver.email, otp, driver.name)

    // Step 13: Generate JWT token
    const token = generateToken(driver._id, "driver")

    // Step 14: Return success response
    res.status(201).json({
      success: true,
      message: "Driver registration completed successfully. Please check your email for the verification code. Your application is now under review.",
      data: { 
        id: driver._id.toString(), 
        token: token,
        driver: {
          id: driver._id,
          name: driver.name,
          email: driver.email,
          phone: driver.phone,
          services: driver.services,
          vehicle: driver.vehicle,
          verificationStatus: driver.verificationStatus,
          registrationStep: driver.registrationStep,
          isVerified: driver.isVerified
        },
        nextSteps: [
          "Verify your email using the OTP sent to your email",
          "Wait for admin approval (24-48 hours)",
          "You will be notified once your application is approved"
        ],
        estimatedReviewTime: '24-48 hours'
      }
    })

  } catch (error) {
    console.error('Complete driver registration error:', error)
    
    // Handle specific MongoDB duplicate key errors
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field} already exists`
      });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }
    
    res.status(500).json({
      success: false,
      message: "Server error during driver registration"
    })
  }
}


// Verify Email OTP
exports.verifyEmailOtp = async (req, res) => {
  try {
    const { email, otp } = req.body
    const role = req.role
    if (!email || !otp) return res.status(400).json({ success: false, message: "Please provide email and OTP" })

    const Model = role === "user" ? User : Driver
    const user = await Model.findById(req.user._id)
    if (!user) return res.status(404).json({ success: false, message: "User not found" })
    if (user.email.toLowerCase() !== email.toLowerCase()) return res.status(400).json({ success: false, message: "Email does not match the authenticated user" })
    if (user.isVerified) return res.status(400).json({ success: false, message: "Email is already verified" })
    if (user.verificationCode !== otp) return res.status(400).json({ success: false, message: "Invalid OTP" })
    if (user.otpExpiry && new Date() > user.otpExpiry) return res.status(400).json({ success: false, message: "OTP has expired. Please request a new one." })

    user.isVerified = true
    user.verificationCode = null
    user.otpExpiry = null
    await user.save()

    const token = generateToken(user._id, role)
    res.json({ success: true, message: "Email verified successfully"})
  } catch {
    res.status(500).json({ success: false, message: "Server error during email verification" })
  }
}

// Resend Email OTP
exports.resendEmailOtp = async (req, res) => {
  try {
    const { email } = req.body
    const role = req.role
    if (!email) return res.status(400).json({ success: false, message: "Please provide email" })

    const Model = role === "user" ? User : Driver
    const user = await Model.findById(req.user._id)
    if (!user) return res.status(404).json({ success: false, message: "User not found" })
    if (user.email.toLowerCase() !== email.toLowerCase()) return res.status(400).json({ success: false, message: "Email does not match the authenticated user" })
    if (user.isVerified) return res.status(400).json({ success: false, message: "Email is already verified" })

    const otp = generateOTP()
    user.verificationCode = otp
    user.otpExpiry = new Date(Date.now() + 10 * 60 * 1000)
    await user.save()

    await sendEmailVerificationOTP(user.email, otp, user.name)
    res.json({ success: true, message: "OTP sent successfully to your email" })
  } catch {
    res.status(500).json({ success: false, message: "Server error while sending OTP" })
  }
}

// Login User
exports.loginUser = async (req, res) => {
  try {
    const { identifier } = req.body
    if (!identifier) return res.status(400).json({ success: false, message: "Please provide email" })

    const user = await User.findOne({ email: identifier.toLowerCase() })
    if (!user) return res.status(400).json({ success: false, message: "Invalid credentials" })

    const token = generateToken(user._id, "user")
    res.json({ success: true, message: "Login successful", data: { id: user._id.toString(), token: token } })
  } catch {
    res.status(500).json({ success: false, message: "Server error during login" })
  }
}

// Login Driver
exports.loginDriver = async (req, res) => {
  try {
    const { identifier } = req.body
    if (!identifier) return res.status(400).json({ success: false, message: "Please provide email" })

    const driver = await Driver.findOne({ $or: [{ email: identifier.toLowerCase() }, { phone: formatPhoneNumber(identifier) }] })
    if (!driver) return res.status(400).json({ success: false, message: "Invalid credentials" })

    const token = generateToken(driver._id, "driver")
    res.json({ success: true, message: "Login successful", data: { id: driver._id.toString(), token: token } })
  } catch {
    res.status(500).json({ success: false, message: "Server error during login" })
  }
}

// Get Profile
exports.getProfile = async (req, res) => {
  try {
    const Model = req.role === "user" ? User : Driver
    const user = await Model.findById(req.user._id).select("-password -verificationCode")
    if (!user) return res.status(404).json({ success: false, message: "User not found" })

    res.json({ success: true, data: { [req.role]: user } })
  } catch {
    res.status(500).json({ success: false, message: "Server error while fetching user info" })
  }
}

// Logout
exports.logout = async (req, res) => {
  try {
    res.json({ success: true, message: "Logged out successfully" })
  } catch {
    res.status(500).json({ success: false, message: "Server error during logout" })
  }
}


const getNextStep = (registrationStep, verificationStatus) => {
  if (verificationStatus === 'approved') return 'registration_complete';
  if (verificationStatus === 'rejected') return 'resubmit_application';
  if (verificationStatus === 'under_review') return 'wait_for_approval';
  
  switch (registrationStep) {
    case 'basic_info': return 'submit_for_verification';
    case 'service_selection': return 'submit_for_verification';
    case 'completed': return 'wait_for_approval';
    default: return 'submit_for_verification';
  }
}