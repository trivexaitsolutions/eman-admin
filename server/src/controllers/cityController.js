// src/controllers/cityController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function cleanText(value, maxLength = 120) {
    const text = String(value || '').trim().replace(/\s+/g, ' ');

    if (!text) {
        return { text: '', tooLong: false };
    }

    return {
        text,
        tooLong: text.length > maxLength,
    };
}

function redirectWithMessage(res, path, key, message) {
    return res.redirect(`${path}?${key}=${encodeURIComponent(message)}`);
}

const listCities = async (req, res) => {
    try {
        const cities = await prisma.city.findMany({
            include: {
                state: {
                    select: {
                        id: true,
                        name: true,
                        code: true,
                    },
                },
                _count: {
                    select: {
                        nakas: true,
                    },
                },
            },
            orderBy: [
                { state: { name: 'asc' } },
                { name: 'asc' },
            ],
        });

        return res.render('admin/cities/index', {
            cities,
            success: req.query.success || null,
            error: req.query.error || null,
        });
    } catch (error) {
        console.error('List Cities Error:', error);
        return res.status(500).send('Server Error');
    }
};

const showForm = async (req, res) => {
    try {
        const [states, city] = await Promise.all([
            prisma.state.findMany({
                orderBy: [
                    { type: 'asc' },
                    { name: 'asc' },
                ],
            }),
            req.params.id
                ? prisma.city.findUnique({
                    where: {
                        id: Number(req.params.id),
                    },
                    include: {
                        _count: {
                            select: {
                                nakas: true,
                            },
                        },
                    },
                })
                : null,
        ]);

        if (req.params.id && !city) {
            return redirectWithMessage(
                res,
                '/admin/cities',
                'error',
                'City was not found.'
            );
        }

        return res.render('admin/cities/form', {
            states,
            city: city || {},
            isEdit: Boolean(city),
            error: req.query.error || null,
        });
    } catch (error) {
        console.error('Show City Form Error:', error);
        return redirectWithMessage(
            res,
            '/admin/cities',
            'error',
            'Unable to open the City form.'
        );
    }
};

const saveCity = async (req, res) => {
    const id = String(req.body.id || '').trim();
    const basePath = id
        ? `/admin/cities/edit/${id}`
        : '/admin/cities/create';

    const fail = (message) =>
        redirectWithMessage(res, basePath, 'error', message);

    try {
        const parsedId = id ? Number(id) : null;
        const parsedStateId = Number(req.body.stateId);
        const name = cleanText(req.body.name, 120);

        if (parsedId && (!Number.isInteger(parsedId) || parsedId <= 0)) {
            return fail('Invalid City ID.');
        }

        if (!name.text || name.text.length < 2) {
            return fail('City name must contain at least 2 characters.');
        }

        if (name.tooLong) {
            return fail('City name cannot exceed 120 characters.');
        }

        if (!Number.isInteger(parsedStateId) || parsedStateId <= 0) {
            return fail('Please select a valid State / Union Territory.');
        }

        const state = await prisma.state.findUnique({
            where: {
                id: parsedStateId,
            },
            select: {
                id: true,
            },
        });

        if (!state) {
            return fail('Selected State / Union Territory was not found.');
        }

        const duplicateCity = await prisma.city.findFirst({
            where: {
                name: name.text,
                stateId: parsedStateId,
                ...(parsedId
                    ? {
                        NOT: {
                            id: parsedId,
                        },
                    }
                    : {}),
            },
            select: {
                id: true,
            },
        });

        if (duplicateCity) {
            return fail(
                'This City already exists under the selected State / Union Territory.'
            );
        }

        if (parsedId) {
            const existingCity = await prisma.city.findUnique({
                where: {
                    id: parsedId,
                },
                include: {
                    _count: {
                        select: {
                            nakas: true,
                        },
                    },
                },
            });

            if (!existingCity) {
                return fail('City was not found.');
            }

            /*
             * A City can receive its State for the first time even when legacy
             * Nakas exist. Once a State is already assigned and Nakas are linked,
             * do not allow moving that City to a different State.
             */
            if (
                existingCity._count.nakas > 0 &&
                existingCity.stateId &&
                existingCity.stateId !== parsedStateId
            ) {
                return fail(
                    'State cannot be changed after Nakas have been added to this City. Create the correct City instead.'
                );
            }

            await prisma.city.update({
                where: {
                    id: parsedId,
                },
                data: {
                    name: name.text,
                    stateId: parsedStateId,
                },
            });
        } else {
            await prisma.city.create({
                data: {
                    name: name.text,
                    stateId: parsedStateId,
                },
            });
        }

        return redirectWithMessage(
            res,
            '/admin/cities',
            'success',
            parsedId
                ? 'City updated successfully.'
                : 'City created successfully.'
        );
    } catch (error) {
        console.error('Save City Error:', error);
        return fail(
            'City save nahi ho paya. Please check the State and City name, then try again.'
        );
    }
};

const deleteCity = async (req, res) => {
    try {
        const cityId = Number(req.params.id);

        if (!Number.isInteger(cityId) || cityId <= 0) {
            return redirectWithMessage(
                res,
                '/admin/cities',
                'error',
                'Invalid City ID.'
            );
        }

        await prisma.city.delete({
            where: {
                id: cityId,
            },
        });

        return redirectWithMessage(
            res,
            '/admin/cities',
            'success',
            'City deleted successfully.'
        );
    } catch (error) {
        console.error('Delete City Error:', error);
        return redirectWithMessage(
            res,
            '/admin/cities',
            'error',
            'Cannot delete City. Remove attached Nakas first.'
        );
    }
};

module.exports = {
    listCities,
    showForm,
    saveCity,
    deleteCity,
};
