// src/controllers/stateController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const listStates = async (req, res) => {
    try {
        const states = await prisma.state.findMany({
            include: {
                _count: { select: { cities: true } },
                cities: {
                    select: {
                        _count: { select: { pincodes: true } },
                    },
                },
            },
            orderBy: [{ type: 'asc' }, { name: 'asc' }],
        });

        const decoratedStates = states.map((state) => ({
            ...state,
            pincodeCount: state.cities.reduce((total, city) => total + city._count.pincodes, 0),
        }));

        return res.render('admin/states/index', { states: decoratedStates });
    } catch (error) {
        console.error('List States Error:', error);
        return res.status(500).send('Server Error');
    }
};

module.exports = { listStates };
