const https = require("https");

const EXPO_PUSH_HOST = "exp.host";
const EXPO_PUSH_PATH = "/--/api/v2/push/send";

const isValidExpoPushToken = (token) => {
    if (typeof token !== "string") {
        return false;
    }

    return (
        token.startsWith("ExponentPushToken[") ||
        token.startsWith("ExpoPushToken[")
    );
};

const sendExpoRequest = (payload) => {
    return new Promise((resolve, reject) => {
        const requestBody = JSON.stringify(payload);

        const request = https.request(
            {
                hostname: EXPO_PUSH_HOST,
                port: 443,
                path: EXPO_PUSH_PATH,
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Accept-Encoding": "gzip, deflate",
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(
                        requestBody
                    )
                }
            },
            (response) => {
                let responseBody = "";

                response.setEncoding("utf8");

                response.on("data", (chunk) => {
                    responseBody += chunk;
                });

                response.on("end", () => {
                    let parsedResponse = null;

                    try {
                        parsedResponse = JSON.parse(
                            responseBody
                        );
                    } catch (parseError) {
                        return reject(
                            new Error(
                                `Invalid Expo response: ${responseBody}`
                            )
                        );
                    }

                    if (
                        response.statusCode < 200 ||
                        response.statusCode >= 300
                    ) {
                        return reject(
                            new Error(
                                parsedResponse?.errors?.[0]?.message ||
                                parsedResponse?.message ||
                                `Expo returned HTTP ${response.statusCode}`
                            )
                        );
                    }

                    resolve(parsedResponse);
                });
            }
        );

        request.on("error", (error) => {
            reject(error);
        });

        request.setTimeout(15000, () => {
            request.destroy(
                new Error("Expo notification request timed out.")
            );
        });

        request.write(requestBody);
        request.end();
    });
};

const sendPushNotification = async (
    pushToken,
    title,
    body,
    data = {}
) => {
    try {
        if (!isValidExpoPushToken(pushToken)) {
            console.error(
                `Push token ${pushToken} is not a valid Expo push token.`
            );

            return false;
        }

        const message = {
            to: pushToken,
            sound: "default",
            title,
            body,
            data,
            priority: "high",
            channelId: "default"
        };

        const expoResponse = await sendExpoRequest(message);

        console.log(
            "Expo Notification Response:",
            JSON.stringify(expoResponse, null, 2)
        );

        const ticket = Array.isArray(expoResponse.data)
            ? expoResponse.data[0]
            : expoResponse.data;

        if (!ticket) {
            console.error(
                "Expo notification ticket missing."
            );

            return false;
        }

        if (ticket.status === "error") {
            console.error(
                "Expo notification rejected:",
                ticket.message,
                ticket.details || {}
            );

            return false;
        }

        console.log(
            "✅ Notification accepted by Expo.",
            ticket.id
                ? `Ticket ID: ${ticket.id}`
                : ""
        );

        return true;
    } catch (error) {
        console.error(
            "Notification bhejne me error:",
            error
        );

        return false;
    }
};

module.exports = {
    sendPushNotification
};