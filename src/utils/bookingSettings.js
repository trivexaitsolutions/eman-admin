const DEFAULT_ASSIGNMENT_MODE = "AUTO";
const DEFAULT_SHOW_MAP_TO_CUSTOMER = false;
const DEFAULT_NEARBY_NAKA_RADIUS_METERS = 5000;
const MIN_NEARBY_NAKA_RADIUS_METERS = 100;
const MAX_NEARBY_NAKA_RADIUS_METERS = 100000;

const DEFAULT_POOL_DAY_START = "08:00";
const DEFAULT_POOL_DAY_END = "20:00";
const DEFAULT_POOL_REDUCTION_TYPE = "FIXED";
const DEFAULT_POOL_REDUCTION_VALUE = 100;
const ALLOWED_POOL_REDUCTION_TYPES = ["FIXED", "PERCENTAGE"];

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

const normalizeTimeValue = (value, fallback) => {
    const text = String(value || "").trim();
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) return fallback;
    return text;
};

const timeToMinutes = (time) => {
    const normalized = normalizeTimeValue(time, "00:00");
    const [hour, minute] = normalized.split(":").map(Number);
    return hour * 60 + minute;
};

const buildIndiaDateForToday = (time, now = new Date()) => {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(now);

    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;

    return new Date(`${year}-${month}-${day}T${normalizeTimeValue(time, "00:00")}:00+05:30`);
};

const getBookingSetting = async (prisma) => {
    const setting = await prisma.bookingSetting.findUnique({
        where: { id: 1 },
        include: {
            poolSlots: {
                where: { isActive: true },
                orderBy: [{ sortOrder: "asc" }, { startTime: "asc" }],
            },
        },
    });

    return {
        assignmentMode: setting?.assignmentMode || DEFAULT_ASSIGNMENT_MODE,
        showMapToCustomer:
            setting?.showMapToCustomer ?? DEFAULT_SHOW_MAP_TO_CUSTOMER,
        nearbyNakaRadiusMeters: normalizeRadiusMeters(
            setting?.nearbyNakaRadiusMeters
        ),
        mapApiKey: setting?.mapApiKey || null,
        poolDayStart: normalizeTimeValue(
            setting?.poolDayStart,
            DEFAULT_POOL_DAY_START
        ),
        poolDayEnd: normalizeTimeValue(
            setting?.poolDayEnd,
            DEFAULT_POOL_DAY_END
        ),
        poolReductionType: ALLOWED_POOL_REDUCTION_TYPES.includes(
            String(setting?.poolReductionType || "").toUpperCase()
        )
            ? String(setting.poolReductionType).toUpperCase()
            : DEFAULT_POOL_REDUCTION_TYPE,
        poolReductionValue: Number.isFinite(Number(setting?.poolReductionValue))
            ? Number(setting.poolReductionValue)
            : DEFAULT_POOL_REDUCTION_VALUE,
        poolSlots:
            Array.isArray(setting?.poolSlots) && setting.poolSlots.length
                ? setting.poolSlots
                : [],
        updatedAt: setting?.updatedAt || null,
    };
};

const getActivePoolContext = async (prisma, now = new Date()) => {
    const setting = await getBookingSetting(prisma);
    const poolStart = buildIndiaDateForToday(setting.poolDayStart, now);
    const poolEnd = buildIndiaDateForToday(setting.poolDayEnd, now);

    const slots = [...(setting.poolSlots || [])]
        .filter((slot) => slot?.isActive !== false)
        .sort((a, b) => {
            const sortDifference = Number(a.sortOrder || 0) - Number(b.sortOrder || 0);
            if (sortDifference !== 0) return sortDifference;
            return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
        });

    const activeSlot = slots
        .filter((slot) => buildIndiaDateForToday(slot.startTime, now) <= now)
        .slice(-1)[0] || null;

    const isOpen = Boolean(
        activeSlot &&
        now >= poolStart &&
        now < poolEnd
    );

    return {
        setting,
        poolStart,
        poolEnd,
        activeSlot,
        activePoolNumber: activeSlot ? Number(activeSlot.sortOrder || 0) + 1 : null,
        isOpen,
        now,
    };
};

const applyPoolReduction = ({
    baseRate,
    poolSortOrder = 0,
    reductionType = DEFAULT_POOL_REDUCTION_TYPE,
    reductionValue = DEFAULT_POOL_REDUCTION_VALUE,
}) => {
    const rate = Number(baseRate);
    const order = Math.max(0, Number(poolSortOrder || 0));
    const value = Math.max(0, Number(reductionValue || 0));

    if (!Number.isFinite(rate)) return 0;

    let reduction = 0;

    if (String(reductionType).toUpperCase() === "PERCENTAGE") {
        reduction = rate * (value / 100) * order;
    } else {
        reduction = value * order;
    }

    return Math.max(0, Number((rate - reduction).toFixed(2)));
};

const toPublicMapSettings = (setting) => ({
    showMap: Boolean(setting.showMapToCustomer),
    radiusMeters: normalizeRadiusMeters(setting.nearbyNakaRadiusMeters),
    apiKey: setting.showMapToCustomer ? setting.mapApiKey || null : null,
});

module.exports = {
    ALLOWED_POOL_REDUCTION_TYPES,
    DEFAULT_ASSIGNMENT_MODE,
    DEFAULT_SHOW_MAP_TO_CUSTOMER,
    DEFAULT_NEARBY_NAKA_RADIUS_METERS,
    DEFAULT_POOL_DAY_START,
    DEFAULT_POOL_DAY_END,
    DEFAULT_POOL_REDUCTION_TYPE,
    DEFAULT_POOL_REDUCTION_VALUE,
    MIN_NEARBY_NAKA_RADIUS_METERS,
    MAX_NEARBY_NAKA_RADIUS_METERS,
    applyPoolReduction,
    buildIndiaDateForToday,
    getActivePoolContext,
    getBookingSetting,
    normalizeRadiusMeters,
    normalizeTimeValue,
    timeToMinutes,
    toPublicMapSettings,
};
