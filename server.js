const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') }); 

console.log('MONGO_URI:', process.env.MONGO_URI); 


const express = require("express")

const mongoose = require("mongoose")
const cors = require("cors")
const http = require("http")


const authRoutes = require('./routes/auth');
require("dotenv").config()

const app = express()
const server = http.createServer(app)

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use('/api/auth', authRoutes);


mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => console.log("MongoDB connection error:", err))

app.use("/api/auth", require("./routes/auth"))
app.use("/api/dashboard", require("./routes/dashboard"))

app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({
    success: false,
    message: "Something went wrong!",
    error: process.env.NODE_ENV === "development" ? err.message : "Internal server error",
  })
})

const PORT = process.env.PORT || 5000
server.listen(PORT, () => {
  console.log(`Vezoh Backend Server running on port ${PORT}`)
})
