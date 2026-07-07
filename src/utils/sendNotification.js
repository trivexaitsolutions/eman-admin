// src/utils/sendNotification.js

let expoClient = null;
let ExpoClass = null;

/**
 * ESM-only expo-server-sdk ko CommonJS project me safely load karta hai.
 */
async function getExpoSdk() {
  if (!ExpoClass) {
    const expoSdk = await import("expo-server-sdk");
    ExpoClass = expoSdk.Expo;
  }

  return ExpoClass;
}

async function getExpoClient() {
  if (!expoClient) {
    const Expo = await getExpoSdk();
    expoClient = new Expo();
  }

  return expoClient;
}

const sendPushNotification = async (pushToken, title, body, data = {}) => {
  try {
    const Expo = await getExpoSdk();

    // Token valid hai ya nahi
    if (!Expo.isExpoPushToken(pushToken)) {
      console.error(
        `Push token ${pushToken} is not a valid Expo push token`
      );
      return false;
    }

    const expo = await getExpoClient();

    const messages = [
      {
        to: pushToken,
        sound: "default",
        title,
        body,
        data,
      },
    ];

    const chunks = expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      console.log("Notification Ticket:", ticketChunk);
    }

    return true;
  } catch (error) {
    console.error("Notification bhejne me error:", error);
    return false;
  }
};

module.exports = {
  sendPushNotification,
};