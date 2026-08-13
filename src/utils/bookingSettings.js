const DEFAULT_ASSIGNMENT_MODE = "AUTO";
const DEFAULT_SHOW_MAP_TO_CUSTOMER = false;
const DEFAULT_NEARBY_NAKA_RADIUS_METERS = 5000;
const MIN_NEARBY_NAKA_RADIUS_METERS = 100;
const MAX_NEARBY_NAKA_RADIUS_METERS = 100000;

const normalizeRadiusMeters = (value) => {
    const radius = Number(value);

    if (!Number.isFinite(radius)) {
        return DEFAULT_NEARBY_NAKA_RADIUS_METERS;
    }

    return Math.min(
        MAX_NEARBY_NAKA_RADIUS_METERS,
        Math.max(MIN_NEARBY_NAKA_RADIUS_METERS, Math.round(radius))
    );
};

const getBookingSetting = async (prisma) => {
    const setting = await prisma.bookingSetting.findUnique({
        where: { id: 1 }
    });

    return {
        assignmentMode: setting?.assignmentMode || DEFAULT_ASSIGNMENT_MODE,
        showMapToCustomer:
            setting?.showMapToCustomer ?? DEFAULT_SHOW_MAP_TO_CUSTOMER,
        nearbyNakaRadiusMeters: normalizeRadiusMeters(
            setting?.nearbyNakaRadiusMeters
        ),
        mapApiKey: setting?.mapApiKey || null,
        updatedAt: setting?.updatedAt || null
    };
};

const toPublicMapSettings = (setting) => ({
    showMap: Boolean(setting.showMapToCustomer),
    radiusMeters: normalizeRadiusMeters(setting.nearbyNakaRadiusMeters),
    // Google Maps client keys are public identifiers. Restrict this key in
    // Google Cloud by Android package/SHA and enabled APIs.
    apiKey: setting.showMapToCustomer ? setting.mapApiKey || null : null
});

module.exports = {
    DEFAULT_ASSIGNMENT_MODE,
    DEFAULT_SHOW_MAP_TO_CUSTOMER,
    DEFAULT_NEARBY_NAKA_RADIUS_METERS,
    MIN_NEARBY_NAKA_RADIUS_METERS,
    MAX_NEARBY_NAKA_RADIUS_METERS,
    getBookingSetting,
    normalizeRadiusMeters,
    toPublicMapSettings
};
