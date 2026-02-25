/**
 * Prophetic Guidance Course Model
 * Converts Squarespace order data into a structured Prophetic Guidance course object.
 */

/**
 * Checks if a course is an Associates Program course
 * @param {string} courseName - Name of the course from Squarespace
 * @returns {boolean} - True if the course is an Associates Program course
 */
export function isPropheticGuidance(courseName) {
  if (!courseName) return false;

  const name = courseName.toLowerCase();
  return (
    name.includes("prophetic") ||
    name.includes("guidance") ||
    name.includes("prophetic guidance")
  );
}

/**
 * Extracts module name from the course section
 * @param {string} section - Section name (e.g., "Module 1")
 * @returns {string} - Extracted module name
 */
function extractModule(section) {
  return section.toLowerCase().includes("module") ? section.trim() : "General";
}

/**
 * Retrieves a variant option value by name
 * @param {Array} options - Array of variant options from the line item
 * @param {string} key - Option name to retrieve (e.g., "Plan", "Section")
 * @returns {string} - Option value
 */
function getVariantOption(options, key) {
  const option = options.find(
    (opt) => opt.optionName.toLowerCase() === key.toLowerCase()
  );
  return option ? option.value : "";
}

/**
 * Retrieves a customization value by label
 * @param {Array} customizations - Array of customizations from the line item
 * @param {string} label - Label to retrieve (e.g., "Gender", "Age")
 * @returns {string} - Customization value
 */
function getCustomization(customizations, label) {
  const customization = customizations.find(
    (cust) => cust.label.toLowerCase() === label.toLowerCase()
  );
  return customization ? customization.value : "";
}

/**
 * Creates a structured Prophetic Guidance course model for a single line item
 * @param {Object} order - Full Squarespace order object
 * @param {Object} item - Line item representing a student enrollment
 * @returns {Object} - Structured course + student model
 */
function createSingleStudentModel(order, item) {
  // Extract student information from customizations
  const fullName = getCustomization(item.customizations, "Name") || "";
  const nameParts = fullName.split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";
  const email = getCustomization(item.customizations, "Email")?.trim();
  const phone = getCustomization(item.customizations, "Phone")?.replace(/\s+/g, "") || "";
  
  // Extract other customizations
  const gender = getCustomization(item.customizations, "Gender");
  const age = getCustomization(item.customizations, "Age");
  const studentType = getCustomization(item.customizations, "I am a");
  const password = getCustomization(item.customizations, "Student Account Password");
  
  // Extract variant options
  const plan = getVariantOption(item.variantOptions, "Plan");
  const section = getVariantOption(item.variantOptions, "Section");

  // Create courseRef based on courseName and section
  const courseRef = `courses/Prophetic Guidance ${section}`;

  return {
    courseId: `${order.id}-${item.id}`,
    orderNumber: order.orderNumber,
    createdOn: order.createdOn,
    courseName: item.productName,
    courseType: "PropheticGuidance",
    courseRef,

    studentInfo: {
      firstName,
      lastName,
      email,
      phone,
      gender,
      age,
      studentType,
      password,
    },

    guidanceDetails: {
      module: extractModule(section),
      plan,
      section,
      imageUrl: item.imageUrl,
      status: "enrolled",
    },

    metadata: {
      lastUpdated: new Date().toISOString(),
    },
  };
}

/**
 * Creates structured Prophetic Guidance course models from the order
 * Each line item represents a different student
 * @param {Object} order - Full Squarespace order object
 * @returns {Array} - Array of structured course + student models
 */
export function createPropheticGuidanceModel(order) {
  // Filter for service line items
  const serviceItems = order.lineItems.filter(
    item => item.lineItemType === "SERVICE" && item.productName === "Prophetic Guidance"
  );
  
  if (serviceItems.length === 0) {
    return [];
  }
  
  // Create a model for each service line item (each student)
  return serviceItems.map(item => createSingleStudentModel(order, item));
}
