const { DEFAULT_NEARBY_NAKA_RADIUS_METERS, normalizeRadiusMeters } = require("./bookingSettings");

const DEFAULT_SERVICE_RADIUS_METERS = DEFAULT_NEARBY_NAKA_RADIUS_METERS;
const NAKA_VERIFIED_STATUS = "VERIFIED";

const getNakaVerificationCutoff = () => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 6);
    return cutoff;
};

const parseCoordinates = (latitude, longitude) => {
    const parsedLatitude = Number(latitude);
    const parsedLongitude = Number(longitude);

    if (
        !Number.isFinite(parsedLatitude) ||
        parsedLatitude < -90 ||
        parsedLatitude > 90 ||
        !Number.isFinite(parsedLongitude) ||
        parsedLongitude < -180 ||
        parsedLongitude > 180
    ) {
        return null;
    }

    return {
        latitude: parsedLatitude,
        longitude: parsedLongitude
    };
};

const toRadians = (value) => (value * Math.PI) / 180;

const calculateDistanceKm = (
    fromLatitude,
    fromLongitude,
    toLatitude,
    toLongitude
) => {
    const earthRadiusKm = 6371;
    const latitudeDelta = toRadians(toLatitude - fromLatitude);
    const longitudeDelta = toRadians(toLongitude - fromLongitude);
    const fromLatitudeRadians = toRadians(fromLatitude);
    const toLatitudeRadians = toRadians(toLatitude);

    const haversine =
        Math.sin(latitudeDelta / 2) ** 2 +
        Math.cos(fromLatitudeRadians) *
            Math.cos(toLatitudeRadians) *
            Math.sin(longitudeDelta / 2) ** 2;

    return (
        earthRadiusKm *
        2 *
        Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
    );
};

const findNearbyVerifiedNakas = async (
    prisma,
    { latitude, longitude, radiusMeters = DEFAULT_SERVICE_RADIUS_METERS }
) => {
    const coordinates = parseCoordinates(latitude, longitude);

    if (!coordinates) {
        const error = new Error("Please provide a valid work location.");
        error.code = "INVALID_WORK_LOCATION";
        throw error;
    }

    const safeRadiusMeters = normalizeRadiusMeters(radiusMeters);
    const safeRadiusKm = safeRadiusMeters / 1000;

    // Bounding box keeps the database query small. Haversine below performs
    // the exact circular-radius check.
    const latitudeDelta = safeRadiusKm / 111.32;
    const longitudeDivisor =
        111.32 * Math.max(Math.cos(toRadians(coordinates.latitude)), 0.01);
    const longitudeDelta = safeRadiusKm / longitudeDivisor;

    const nakas = await prisma.naka.findMany({
        where: {
            verificationStatus: NAKA_VERIFIED_STATUS,
            lastVerifiedAt: {
                gte: getNakaVerificationCutoff()
            },
            latitude: {
                not: null,
                gte: coordinates.latitude - latitudeDelta,
                lte: coordinates.latitude + latitudeDelta
            },
            longitude: {
                not: null,
                gte: coordinates.longitude - longitudeDelta,
                lte: coordinates.longitude + longitudeDelta
            }
        },
        select: {
            id: true,
            name: true,
            pincode: true,
            landmark: true,
            latitude: true,
            longitude: true,
            cityId: true,
            city: {
                select: {
                    id: true,
                    name: true
                }
            }
        }
    });

    const nearbyNakas = nakas
        .map((naka) => ({
            ...naka,
            distanceKm: calculateDistanceKm(
                coordinates.latitude,
                coordinates.longitude,
                Number(naka.latitude),
                Number(naka.longitude)
            )
        }))
        .filter((naka) => naka.distanceKm <= safeRadiusKm)
        .sort((first, second) => first.distanceKm - second.distanceKm)
        .map((naka) => ({
            ...naka,
            distanceKm: Number(naka.distanceKm.toFixed(2)),
            distanceMeters: Math.round(naka.distanceKm * 1000)
        }));

    return {
        workLocation: coordinates,
        radiusMeters: safeRadiusMeters,
        radiusKm: safeRadiusKm,
        nearbyNakas,
        // Kept for mobile backward compatibility. This is now the complete
        // immutable pool; the customer never selects or removes a Naka.
        selectedNakas: nearbyNakas
    };
};

module.exports = {
    DEFAULT_SERVICE_RADIUS_METERS,
    calculateDistanceKm,
    findNearbyVerifiedNakas,
    parseCoordinates
};
