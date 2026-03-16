// notificationsController.js
const User = require('../modals/User');
const admin = require('../../firebase'); // our firebase-admin instance
const MAX_MULTICAST = 500; // FCM sendMulticast limit

// Utility: chunk array into parts of size n
function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// Save / update device token
const notificationToken = async (req, res) => {
  try {
    const { deviceToken, userId, platform, timestamp } = req.body;
    console.log('Received notificationToken request:', req.body);
    if (!deviceToken) {
      return res.status(400).json({
        success: false,
        message: 'deviceToken is required',
      });
    }

    // If userId provided → attach token to user
    if (userId) {
      const user = await User.findById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found',
        });
      }

      const tokenIndex = user.deviceTokens.findIndex(
        (t) => t.token === deviceToken
      );

      if (tokenIndex > -1) {
        // Update existing token timestamp & platform
        user.deviceTokens[tokenIndex].lastUsedAt = timestamp || new Date();
        user.deviceTokens[tokenIndex].platform = platform || user.deviceTokens[tokenIndex].platform;
      } else {
        // Add new token
        user.deviceTokens.push({
          token: deviceToken,
          platform: platform || 'unknown',
          lastUsedAt: timestamp || new Date(),
        });
      }

      await user.save();
    } else {
      // If no userId, you may want to save into a generic collection or return success —
      // here we simply return success (you can implement global token storage if needed).
      // Optionally log or handle anonymous tokens.
      console.log('Received token without userId:', deviceToken);
    }

    return res.status(200).json({
      success: true,
      message: 'Notification token saved successfully',
    });
  } catch (error) {
    console.error('notificationToken error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save notification token',
      error: error.message,
    });
  }
};

// Send notification via Firebase Admin (multicast with token cleanup)
const sendNotification = async (req, res) => {
  try {
    const { userId, title, body, data } = req.body;

    if (!userId || !title || !body) {
      return res.status(400).json({
        success: false,
        message: 'userId, title and body are required',
      });
    }

    // 1) Find user
    const user = await User.findById(userId);

    if (!user || !user.deviceTokens?.length) {
      return res.status(404).json({
        success: false,
        message: 'No device tokens found for user',
      });
    }

    // 2) Collect tokens
    const tokens = user.deviceTokens.map((d) => d.token).filter(Boolean);

    if (!tokens.length) {
      return res.status(400).json({
        success: false,
        message: 'No valid device tokens to send',
      });
    }

    // 3) Chunk tokens by MAX_MULTICAST (500)
    const chunks = chunkArray(tokens, MAX_MULTICAST);

    const results = {
      successCount: 0,
      failureCount: 0,
      responses: [],
    };

    // Keep track of tokens to remove (invalid / unregistered)
    const tokensToRemove = new Set();

    // 4) Send each chunk
    for (const chunk of chunks) {
      const message = {
        tokens: chunk,
        notification: {
          title,
          body,
        },
        data: data || {},
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
      };

      const response = await admin.messaging().sendEachForMulticast(message);
      results.successCount += response.successCount;
      results.failureCount += response.failureCount;
      results.responses.push(response);

      // 5) Inspect responses and mark tokens to remove if unregistered / invalid
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const err = resp.error;
          const token = chunk[idx];
          // Common error codes: messaging/registration-token-not-registered, messaging/invalid-registration-token
          if (err) {
            console.warn('FCM send error for token', token, err.code, err.message);
            if (
              err.code === 'messaging/registration-token-not-registered' ||
              err.code === 'messaging/invalid-registration-token' ||
              err.code === 'messaging/invalid-argument'
            ) {
              tokensToRemove.add(token);
            }
          }
        }
      });
    }

    // 6) Remove invalid tokens from user.deviceTokens
    if (tokensToRemove.size > 0) {
      user.deviceTokens = user.deviceTokens.filter((d) => !tokensToRemove.has(d.token));
      await user.save();
      console.log('Removed invalid tokens:', Array.from(tokensToRemove));
    }

    return res.status(200).json({
      success: true,
      message: 'Notification send attempted',
      successCount: results.successCount,
      failureCount: results.failureCount,
      details: results.responses,
    });
  } catch (error) {
    console.error('Send notification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send notification',
      error: error.message,
    });
  }
};

module.exports = { notificationToken, sendNotification };
