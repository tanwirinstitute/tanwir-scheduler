/**
 * Associates Program Course Model
 * Maps Squarespace order data to a structured format for the Associates Program course
 */

/**
 * Checks if a course is an Associates Program course
 * @param {string} courseName - Name of the course from Squarespace
 * @returns {boolean} - True if the course is an Associates Program course
 */
export function isAssociatesProgram(courseName) {
  if (!courseName) return false;

  const name = courseName.toLowerCase();
  return (
    name.includes("associates") ||
    name.includes("associate's") ||
    name.includes("program")
  );
}

/**
 * Extract level information from the section (e.g., "Year 1" → "Year 1")
 * @param {string} section
 * @returns {string}
 */
function extractLevel(section) {
  return section.trim();
}

/**
 * Helper to get a variant option by name
 * @param {Array} options - variantOptions array
 * @param {string} key - option name to extract (e.g., "Plan", "Section")
 * @returns {string}
 */
function getVariantOption(options, key) {
  const found = options.find(
    (opt) => opt.optionName.toLowerCase() === key.toLowerCase()
  );
  return found ? found.value : "";
}

/**
 * Creates a structured Associates Program course model for a single line item
 * @param {Object} order - Full Squarespace order object
 * @param {Object} item - Line item representing a student enrollment
 * @returns {Object} - Structured course + student model
 */
function createSingleStudentModel(order, item) {
  const customizations = Object.fromEntries(
    item.customizations.map((c) => [c.label, c.value])
  );

  const plan = getVariantOption(item.variantOptions, "Plan");
  const section = getVariantOption(item.variantOptions, "Section");

  // Create courseRef based on courseName and section
  const courseRef = `courses/Associates Program ${section}`;

  // Extract student information from customizations
  const fullName = customizations["Name"] || "";
  const nameParts = fullName.split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";
  const email = customizations["Email"]?.trim();
  const phone = customizations["Phone"]?.replace(/\s+/g, "") || "";
  
  // Extract other customizations
  const gender = customizations["Gender"];
  const age = customizations["Age"];
  const studentType = customizations["I am a"];
  const password = customizations["Student Account Password"];
  const arabicReadingAbility = customizations["Arabic Reading Ability"];
  const arabicWritingAbility = customizations["How would you rate your Arabic writing ability?"];
  const studiedIslamicSciences = customizations["Have you studied Islamic sciences before (e.g. Aqeedah, Fiqh, Tafsir, Hadith)?"];
  const previousTopics = customizations["If yes, please list some of the topics you've studied and where:"];
  const interestReason = customizations["Why are you interested in this course?"];

  return {
    courseId: `${order.id}-${item.id}`,
    orderNumber: order.orderNumber,
    createdOn: order.createdOn,
    courseName: item.productName,
    courseType: "AssociatesProgram",
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

    placementInfo: {
      arabicProficiency: arabicReadingAbility,
      readingAbility: arabicReadingAbility,
      writingAbility: arabicWritingAbility,
      listeningAbility: customizations["How would you rate your Arabic listening and comprehension?"] || "Not specified",
      studiedIslamicSciences,
      previousTopics,
      interestReason,
      level: extractLevel(section),
      plan,
      section,
    },
  };
}

/**
 * Creates structured Associates Program course models from the order
 * Each line item represents a different student
 * @param {Object} order - Full Squarespace order object
 * @returns {Array} - Array of structured course + student models
 */
export function createAssociatesProgramModel(order) {
  // Filter for service line items
  const serviceItems = order.lineItems.filter(
    item => item.lineItemType === "SERVICE" && item.productName === "Associates Program"
  );
  
  if (serviceItems.length === 0) {
    return [];
  }
  
  // Create a model for each service line item (each student)
  return serviceItems.map(item => createSingleStudentModel(order, item));
}
