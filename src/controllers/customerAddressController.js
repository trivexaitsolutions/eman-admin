// src/controllers/customerAddressController.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const getAddresses = async (req, res) => {
  try {
    const { customerId } = req.params;

    const addresses = await prisma.customerAddress.findMany({
      where: {
        customerId: parseInt(customerId),
      },
      orderBy: [
        { isDefault: "desc" },
        { createdAt: "desc" },
      ],
    });

    return res.json({
      success: true,
      addresses,
    });
  } catch (error) {
    console.error("Get Customer Addresses Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching addresses.",
      error: error.message,
    });
  }
};

const addAddress = async (req, res) => {
  try {
    const {
      customerId,
      title,
      fullName,
      phone,
      addressLine,
      landmark,
      cityId,
      city,
      nakaId,
      nakaName,
      state,
      pincode,
      latitude,
      longitude,
      isDefault,
    } = req.body;

    if (!customerId || !addressLine || !cityId || !city || !nakaId || !nakaName) {
      return res.status(400).json({
        success: false,
        message: "customerId, addressLine, city and naka are required.",
      });
    }

    const customer = await prisma.customer.findUnique({
      where: {
        id: parseInt(customerId),
      },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found.",
      });
    }

    if (isDefault) {
      await prisma.customerAddress.updateMany({
        where: {
          customerId: parseInt(customerId),
        },
        data: {
          isDefault: false,
        },
      });
    }

    const address = await prisma.customerAddress.create({
      data: {
        customerId: parseInt(customerId),

        title: title || null,
        fullName: fullName || null,
        phone: phone || null,

        addressLine,
        landmark: landmark || null,

        cityId: cityId ? parseInt(cityId) : null,
        city: city || null,

        nakaId: nakaId ? parseInt(nakaId) : null,
        nakaName: nakaName || null,

        state: state || null,
        pincode: pincode || null,

        latitude: latitude || null,
        longitude: longitude || null,

        isDefault: !!isDefault,
      },
    });

    return res.json({
      success: true,
      message: "Address added successfully.",
      address,
    });
  } catch (error) {
    console.error("Add Customer Address Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while adding address.",
      error: error.message,
    });
  }
};

const updateAddress = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      customerId,
      title,
      fullName,
      phone,
      addressLine,
      landmark,
      cityId,
      city,
      nakaId,
      nakaName,
      state,
      pincode,
      latitude,
      longitude,
      isDefault,
    } = req.body;

    const existingAddress = await prisma.customerAddress.findUnique({
      where: {
        id: parseInt(id),
      },
    });

    if (!existingAddress) {
      return res.status(404).json({
        success: false,
        message: "Address not found.",
      });
    }

    const finalCustomerId = customerId
      ? parseInt(customerId)
      : existingAddress.customerId;

    if (isDefault) {
      await prisma.customerAddress.updateMany({
        where: {
          customerId: finalCustomerId,
          NOT: {
            id: parseInt(id),
          },
        },
        data: {
          isDefault: false,
        },
      });
    }

    const address = await prisma.customerAddress.update({
      where: {
        id: parseInt(id),
      },
      data: {
        title: title || null,
        fullName: fullName || null,
        phone: phone || null,

        addressLine: addressLine || existingAddress.addressLine,
        landmark: landmark || null,

        cityId: cityId ? parseInt(cityId) : existingAddress.cityId,
        city: city || existingAddress.city,

        nakaId: nakaId ? parseInt(nakaId) : existingAddress.nakaId,
        nakaName: nakaName || existingAddress.nakaName,

        state: state || null,
        pincode: pincode || null,

        latitude: latitude || null,
        longitude: longitude || null,

        isDefault: !!isDefault,
      },
    });

    return res.json({
      success: true,
      message: "Address updated successfully.",
      address,
    });
  } catch (error) {
    console.error("Update Customer Address Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating address.",
      error: error.message,
    });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const { id } = req.params;

    const existingAddress = await prisma.customerAddress.findUnique({
      where: {
        id: parseInt(id),
      },
    });

    if (!existingAddress) {
      return res.status(404).json({
        success: false,
        message: "Address not found.",
      });
    }

    await prisma.customerAddress.delete({
      where: {
        id: parseInt(id),
      },
    });

    return res.json({
      success: true,
      message: "Address deleted successfully.",
    });
  } catch (error) {
    console.error("Delete Customer Address Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while deleting address.",
      error: error.message,
    });
  }
};

module.exports = {
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
};