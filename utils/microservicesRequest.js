const axios = require("axios");

/**
 * Generic function to make API requests using Axios.
 *
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE)
 * @param {string} url - API endpoint URL
 * @param {object} [params={}] - Query parameters for GET requests
 * @param {object} [body={}] - Request body for POST, PUT requests
 * @param {object} [headers={}] - Custom headers (optional)
 * @returns {Promise<object>} - API response data or error
 */
const apiRequest = async (
  method,
  url,
  params = {},
  body = {},
  headers = {},
  responceDataObject = "data"
) => {
  try {
    const response = await axios({
      method,
      url,
      params, // Used for GET requests
      data: body, // Used for POST, PUT requests
      headers,
    });

    return response.data;
  } catch (error) {
    console.log("Full error object:", error?.response?.data);
    throw new Error("API response returned an error"); // Log the error message
  }
};

module.exports = apiRequest;
