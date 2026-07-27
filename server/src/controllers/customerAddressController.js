const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const hasValue = (value) =>
  value !== undefined &&
  value !== null &&
  String(value).trim() !== "";

const cleanText = (value) => {
  const text = String(value || "").trim();
  return text || null;
};

const cleanPincode = (value) => {
  const rawValue = cleanText(value);

  if (!rawValue) {
    return null;
  }

  return rawValue.replace(/\D/g, "");
};

const parsePositiveId = (value, fieldLabel) => {
  if (!hasValue(value)) {
    return null;
  }

  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    throw new Error(`${fieldLabel} is invalid.`);
  }

  return parsedValue;
};

const parseCoordinate = (value, fieldLabel, min, max) => {
  const rawValue = cleanText(value);

  if (!rawValue) {
    return null;
  }

  const parsedValue = Number(rawValue);

  if (
    !Number.isFinite(parsedValue) ||
    parsedValue < min ||
    parsedValue > max
  ) {
    throw new Error(`${fieldLabel} is invalid.`);
  }

  return parsedValue.toFixed(6);
};

const parseOptionalBoolean = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (
    value === true ||
    value === "true" ||
    value === "1" ||
    value === 1
  ) {
    return true;
  }

  if (
    value === false ||
    value === "false" ||
    value === "0" ||
    value === 0
  ) {
    return false;
  }

  return null;
};

const getSafeLocationSource = (value) => {
  const source = cleanText(value);

  if (!source) {
    return null;
  }

  const allowedSources = [
    "CURRENT_LOCATION",
    "SEARCH",
    "MAP_PIN",
    "MANUAL",
  ];

  if (!allowedSources.includes(source)) {
    throw new Error("Location source is invalid.");
  }

  return source;
};

const validateReferenceData = async ({ cityId, nakaId, city, nakaName }) => {
  let finalCity = cleanText(city);
  let finalNakaName = cleanText(nakaName);

  if (cityId) {
    const selectedCity = await prisma.city.findUnique({
      where: { id: cityId },
      select: {
        id: true,
        name: true,
      },
    });

    if (!selectedCity) {
      throw new Error("Selected city was not found.");
    }

    finalCity = finalCity || selectedCity.name;
  }

  if (nakaId) {
    const selectedNaka = await prisma.naka.findUnique({
      where: { id: nakaId },
      select: {
        id: true,
        name: true,
      },
    });

    if (!selectedNaka) {
      throw new Error("Selected Naka was not found.");
    }

    finalNakaName = finalNakaName || selectedNaka.name;
  }

  return {
    city: finalCity,
    nakaName: finalNakaName,
  };
};

const buildAddressPayload = async (body, existingAddress = null) => {
  const incomingAddressLine = cleanText(body.addressLine);

  const finalAddressLine =
    incomingAddressLine ||
    existingAddress?.addressLine ||
    null;

  if (!finalAddressLine || finalAddressLine.length < 5) {
    throw new Error("Please enter a complete address.");
  }

  const addressDetail = hasValue(body.addressDetail)
    ? cleanText(body.addressDetail)
    : existingAddress?.addressDetail || null;

  const mapAddress = hasValue(body.mapAddress)
    ? cleanText(body.mapAddress)
    : existingAddress?.mapAddress || null;

  const landmark = hasValue(body.landmark)
    ? cleanText(body.landmark)
    : existingAddress?.landmark || null;

  const cityId = hasValue(body.cityId)
    ? parsePositiveId(body.cityId, "City")
    : existingAddress?.cityId || null;

  const nakaId = hasValue(body.nakaId)
    ? parsePositiveId(body.nakaId, "Naka")
    : existingAddress?.nakaId || null;

  const referenceData = await validateReferenceData({
    cityId,
    nakaId,
    city: hasValue(body.city) ? body.city : existingAddress?.city,
    nakaName: hasValue(body.nakaName)
      ? body.nakaName
      : existingAddress?.nakaName,
  });

  const pincode = hasValue(body.pincode)
    ? cleanPincode(body.pincode)
    : existingAddress?.pincode || null;

  if (pincode && !/^\d{6}$/.test(pincode)) {
    throw new Error("Pincode must contain exactly 6 digits.");
  }

  const latitude = hasValue(body.latitude)
    ? parseCoordinate(body.latitude, "Latitude", -90, 90)
    : existingAddress?.latitude || null;

  const longitude = hasValue(body.longitude)
    ? parseCoordinate(body.longitude, "Longitude", -180, 180)
    : existingAddress?.longitude || null;

  if ((latitude && !longitude) || (!latitude && longitude)) {
    throw new Error(
      "Both latitude and longitude are required when map location is selected."
    );
  }

  const state = hasValue(body.state)
    ? cleanText(body.state)
    : existingAddress?.state || null;

  const placeId = hasValue(body.placeId)
    ? cleanText(body.placeId)
    : existingAddress?.placeId || null;

  const locationSource = hasValue(body.locationSource)
    ? getSafeLocationSource(body.locationSource)
    : existingAddress?.locationSource || null;

  return {
    title: hasValue(body.title)
      ? cleanText(body.title)
      : existingAddress?.title || null,

    fullName: hasValue(body.fullName)
      ? cleanText(body.fullName)
      : existingAddress?.fullName || null,

    phone: hasValue(body.phone)
      ? cleanText(body.phone)
      : existingAddress?.phone || null,

    addressLine: finalAddressLine,
    addressDetail,
    mapAddress,
    landmark,

    cityId,
    city: referenceData.city,

    nakaId,
    nakaName: referenceData.nakaName,

    state,
    pincode,

    latitude,
    longitude,

    placeId,
    locationSource,
  };
};

const getAddresses = async (req, res) => {
  try {
    const customerId = parsePositiveId(
      req.params.customerId,
      "Customer ID"
    );

    const addresses = await prisma.customerAddress.findMany({
      where: { customerId },
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

    return res.status(400).json({
      success: false,
      message: error.message || "Unable to fetch addresses.",
    });
  }
};

const addAddress = async (req, res) => {
  try {
    const customerId = parsePositiveId(
      req.body.customerId,
      "Customer ID"
    );

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found.",
      });
    }

    const addressData = await buildAddressPayload(req.body);

    const requestedDefault = parseOptionalBoolean(req.body.isDefault);

    const existingAddressCount = await prisma.customerAddress.count({
      where: { customerId },
    });

    const shouldBeDefault =
      requestedDefault === true || existingAddressCount === 0;

    const address = await prisma.$transaction(async (tx) => {
      if (shouldBeDefault) {
        await tx.customerAddress.updateMany({
          where: { customerId },
          data: { isDefault: false },
        });
      }

      return tx.customerAddress.create({
        data: {
          customerId,
          ...addressData,
          isDefault: shouldBeDefault,
        },
      });
    });

    return res.json({
      success: true,
      message: "Address added successfully.",
      address,
    });
  } catch (error) {
    console.error("Add Customer Address Error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Unable to add address.",
    });
  }
};

const updateAddress = async (req, res) => {
  try {
    const addressId = parsePositiveId(req.params.id, "Address ID");

    const existingAddress = await prisma.customerAddress.findUnique({
      where: { id: addressId },
    });

    if (!existingAddress) {
      return res.status(404).json({
        success: false,
        message: "Address not found.",
      });
    }

    const addressData = await buildAddressPayload(
      req.body,
      existingAddress
    );

    const requestedDefault = parseOptionalBoolean(req.body.isDefault);

    const finalIsDefault =
      requestedDefault === null
        ? existingAddress.isDefault
        : requestedDefault;

    const address = await prisma.$transaction(async (tx) => {
      if (finalIsDefault) {
        await tx.customerAddress.updateMany({
          where: {
            customerId: existingAddress.customerId,
            NOT: { id: addressId },
          },
          data: { isDefault: false },
        });
      }

      return tx.customerAddress.update({
        where: { id: addressId },
        data: {
          ...addressData,
          isDefault: finalIsDefault,
        },
      });
    });

    return res.json({
      success: true,
      message: "Address updated successfully.",
      address,
    });
  } catch (error) {
    console.error("Update Customer Address Error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Unable to update address.",
    });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const addressId = parsePositiveId(req.params.id, "Address ID");

    const existingAddress = await prisma.customerAddress.findUnique({
      where: { id: addressId },
    });

    if (!existingAddress) {
      return res.status(404).json({
        success: false,
        message: "Address not found.",
      });
    }

    await prisma.customerAddress.delete({
      where: { id: addressId },
    });

    const remainingAddresses = await prisma.customerAddress.findMany({
      where: {
        customerId: existingAddress.customerId,
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    const hasDefaultAddress = remainingAddresses.some(
      (address) => address.isDefault
    );

    if (remainingAddresses.length > 0 && !hasDefaultAddress) {
      await prisma.customerAddress.update({
        where: {
          id: remainingAddresses[0].id,
        },
        data: {
          isDefault: true,
        },
      });
    }

    return res.json({
      success: true,
      message: "Address deleted successfully.",
    });
  } catch (error) {
    console.error("Delete Customer Address Error:", error);

    return res.status(400).json({
      success: false,
      message: error.message || "Unable to delete address.",
    });
  }
};

module.exports = {
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
};