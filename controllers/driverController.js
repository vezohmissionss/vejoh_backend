
const Driver = require('../models/driver');
const { validationResult } = require('express-validator');

class DriverController {
  async submitForVerification(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const driverId = req.user._id;
      const driver = await Driver.findById(driverId);

      if (!driver) {
        return res.status(404).json({
          success: false,
          message: 'Driver not found'
        });
      }

      // Check phone verification
      if (!driver.isVerified) {
        return res.status(403).json({
          success: false,
          message: 'Please verify your phone number first'
        });
      }

      // Check current verification status
      if (driver.verificationStatus === 'under_review') {
        return res.status(400).json({
          success: false,
          message: 'Application is already under review'
        });
      }

      if (driver.verificationStatus === 'approved') {
        return res.status(400).json({
          success: false,
          message: 'Driver is already approved'
        });
      }

      // Parse services safely
      let services;
      try {
        services = typeof req.body.services === 'string'
          ? JSON.parse(req.body.services)
          : req.body.services;
        if (!Array.isArray(services)) throw new Error();
      } catch {
        return res.status(400).json({
          success: false,
          message: 'Invalid services format. Should be a JSON array.'
        });
      }

      // Check required document uploads
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

      // Validate plate number
      if (!req.body.plateNumber) {
        return res.status(400).json({
          success: false,
          message: 'Plate number is required'
        });
      }
      const plateNumber = req.body.plateNumber.toUpperCase();
      
      // Prevent duplicate plate numbers
      const existingPlate = await Driver.findOne({ 
        'vehicle.plateNumber': plateNumber,
        _id: { $ne: driverId }
      });
      if (existingPlate) {
        return res.status(400).json({
          success: false,
          message: 'Vehicle with this plate number is already registered'
        });
      }

      // Prepare submission data
      const submissionData = {
        services,
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
        verificationStatus: 'under_review',
        registrationStep: 'completed'
      };

      const updatedDriver = await Driver.findByIdAndUpdate(
        driverId,
        { $set: submissionData },
        { new: true, runValidators: true }
      ).select('-password -verificationCode -__v');

      res.json({
        success: true,
        message: 'Application submitted successfully. Your registration is now under review.',
        data: { 
          driver: updatedDriver,
          estimatedReviewTime: '24-48 hours'
        }
      });

    } catch (error) {
      console.error('Submit for verification error:', error);
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return res.status(400).json({
          success: false,
          message: `${field} already exists`
        });
      }
      res.status(500).json({
        success: false,
        message: 'Submission failed'
      });
    }
  }

  // Helper to determine next step
  getNextStep(registrationStep, verificationStatus) {
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
}

module.exports = new DriverController();
