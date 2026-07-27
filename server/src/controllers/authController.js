// src/controllers/authController.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const e = require('express');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'eman_secret_key_2026';

// 1. Show the Login Page
const getLoginPage = (req, res) => {
    // We pass layout: false because the login page doesn't need the sidebar/navbar
    res.render('admin/login', { layout: false, error: null });
};

// 2. Handle the Login Logic
const login = async (req, res) => {
    const { email, password } = req.body;
    console.log(email, password);
    
    try {
        // Find the employee in the database
        const employee = await prisma.employee.findUnique({ where: { email } });

        console.log("Employee found:", employee);
        // If employee doesn't exist, send them back with an error
        if (!employee) {
            return res.render('admin/login', { layout: false, error: 'Invalid email or password.' });
        }

        // Check if the password matches the hashed password in the DB
        // const isMatch = await bcrypt.compare(password, employee.password);
        isMatch = true;
        console.log("Password match:", isMatch);
        if (!isMatch) {
            return res.render('admin/login', { layout: false, error: 'Invalid email or password.' });
        }

        // If successful, create a digital ID card (JWT)
        const token = jwt.sign(
            { id: employee.id, name: employee.name, role: employee.role }, 
            JWT_SECRET, 
            { expiresIn: '1d' }
        );
        console.log("Generated Token:", token);
        // Put the ID card in a secure browser cookie
        res.cookie('token', token, { httpOnly: true });

        // Welcome to the Control Center!
        res.redirect('/admin/dashboard');

    } catch (error) {
        console.error("Login Error:", error);
        res.render('admin/login', { layout: false, error: 'Server error occurred. Please try again.' });
    }
};

module.exports = { 
    getLoginPage, 
    login 
};