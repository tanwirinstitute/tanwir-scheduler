/**
 * Badr Program Model
 * Maps Squarespace order data to a structured format for the Badr Program
 * Stores data in the programs collection instead of authorizedUsers
 */

/**
 * Checks if a course is a Badr Program course
 * @param {string} courseName - Name of the course from Squarespace
 * @returns {boolean} - True if the course is a Badr Program course
 */
export function isBadrProgram(courseName) {
  if (!courseName) return false;

  const name = courseName.toLowerCase();
  return (
    name.includes("badr") ||
    name.includes("commemoration of the battle of badr")
  );
}


/**
 * Retrieves a customization value by label
 * @param {Array} customizations - Array of customizations from the line item
 * @param {string} label - Label to retrieve
 * @returns {string} - Customization value
 */
function getCustomization(customizations, label) {
  const customization = customizations.find(
    (cust) => cust.label.toLowerCase() === label.toLowerCase()
  );
  return customization ? customization.value : "";
}

/**
 * Creates a structured Badr Program model for a single line item
 * @param {Object} order - Full Squarespace order object
 * @param {Object} item - Line item representing a program enrollment
 * @returns {Object} - Structured program model
 */
function createSingleProgramModel(order, item) {
  // Extract participant information from customizations
  const fullName = getCustomization(item.customizations, "Name") || "";
  const nameParts = fullName.split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";
  const email = getCustomization(item.customizations, "Email")?.trim();
  const phone = getCustomization(item.customizations, "Phone")?.replace(/\s+/g, "") || "";
  const attendeeCount = getCustomization(item.customizations, "How Many Attending?") || "1";

  // Build customizations object from all available customizations
  const customizations = {};
  item.customizations.forEach(c => {
    customizations[c.label] = c.value;
  });

  return {
    programId: `${order.id}-${item.id}`,
    orderNumber: order.orderNumber,
    orderId: order.id,
    createdOn: order.createdOn,
    programName: item.productName,
    programType: "BadrProgram",

    participantInfo: {
      firstName,
      lastName,
      email,
      phone,
      attendeeCount: parseInt(attendeeCount) || 1,
    },

    programDetails: {
      imageUrl: item.imageUrl,
      status: "registered",
      sku: item.sku,
      productId: item.productId,
    },

    customizations,

    orderInfo: {
      billingAddress: order.billingAddress,
      customerEmail: order.customerEmail,
      fulfillmentStatus: order.fulfillmentStatus,
      grandTotal: order.grandTotal,
    },

    metadata: {
      lastUpdated: new Date().toISOString(),
    },
  };
}

/**
 * Creates structured Badr Program models from the order
 * Each line item represents a different participant
 * @param {Object} order - Full Squarespace order object
 * @returns {Array} - Array of structured program models
 */
export function createBadrProgramModel(order) {
  // Filter for service line items that match Badr Program
  const serviceItems = order.lineItems.filter(
    item => item.lineItemType === "SERVICE" && isBadrProgram(item.productName)
  );
  
  if (serviceItems.length === 0) {
    return [];
  }
  
  // Create a model for each service line item (each participant)
  return serviceItems.map(item => createSingleProgramModel(order, item));
}
