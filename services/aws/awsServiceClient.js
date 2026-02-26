const axios = require("axios");
// i have microservice of aws then i want to create a client for that microservice with class name AwsServiceClient
class AwsServiceClient {
  constructor() {
    // Initialize any required properties here with axios
    this.baseUrl = process.env.S3_MICROSERVICE_MTA_BASE_URL; // Example base URL
    this.axios = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.S3_MICROSERVICE_API_KEY,
      },
    });
  }
  // now we need to create method for creating tenant in aws microservice
  /**
   *
   * @param {*} tenantData
   * @returns
   */
  async createTenant(tenantData = {}) {
    try {
      const response = await this.axios.post("/tenants", tenantData);
      return response.data;
    } catch (error) {
      console.error("Error creating tenant:", error);
      throw error;
    }
  }
  // to get presigned url from aws microservice
  async getPresignedUrl(tenantId, resourceId, resourceType, data = {}) {
    if (!tenantId || !resourceType) {
      throw new Error(
        "tenantId and resourceType are required to get presigned URL",
      );
    }
    try {
      const response = await this.axios.post(
        `/tenants/${tenantId}/classrooms/${resourceId}/media/presign`,
        {
          resourceType,
          ...data,
        },
      );
      return response.data;
    } catch (error) {
      console.error("Error getting presigned URL:", error);
      throw error;
    }
  }
}

module.exports = new AwsServiceClient();
