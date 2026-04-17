// src/controllers/employeeController.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

// 1. List All Employees
const listEmployees = async (req, res) => {
    try {
        const employees = await prisma.employee.findMany({
            orderBy: { createdAt: 'desc' }
        });
        res.render('admin/employees/index', { employees });
    } catch (error) {
        console.error(error);
        res.status(500).send("Error loading employees");
    }
};

// 2. Show Form (Used for BOTH Create and Edit)
const showForm = async (req, res) => {
    try {
        let employee = {};
        let isEdit = false;
        
        // If there's an ID in the URL, we are Editing
        if (req.params.id) {
            employee = await prisma.employee.findUnique({ 
                where: { id: parseInt(req.params.id) } 
            });
            isEdit = true;
        }
        
        res.render('admin/employees/form', { employee, isEdit });
    } catch (error) {
        console.error(error);
        res.redirect('/admin/employees');
    }
};

// 3. Save Employee (Create or Update logic)
const saveEmployee = async (req, res) => {
    const { id, name, email, role, password } = req.body;
    
    try {
        if (id) {
            // --- UPDATE EXISTING ---
            const updateData = { name, email, role };
            // Only hash and update password if they typed a new one
            if (password && password.trim() !== "") {
                updateData.password = await bcrypt.hash(password, 10);
            }
            await prisma.employee.update({
                where: { id: parseInt(id) },
                data: updateData
            });
        } else {
            // --- CREATE NEW ---
            const hashedPassword = await bcrypt.hash(password, 10);
            await prisma.employee.create({
                data: { name, email, role, password: hashedPassword }
            });
        }
        res.redirect('/admin/employees');
    } catch (error) {
        console.error(error);
        res.status(500).send("Error saving employee. Email might already exist.");
    }
};

// 4. Delete Employee
const deleteEmployee = async (req, res) => {
    try {
        await prisma.employee.delete({ 
            where: { id: parseInt(req.params.id) } 
        });
        res.redirect('/admin/employees');
    } catch (error) {
        console.error(error);
        res.redirect('/admin/employees');
    }
};

module.exports = { listEmployees, showForm, saveEmployee, deleteEmployee };