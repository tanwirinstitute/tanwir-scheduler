/**
 * Associates Program Course Model
 * Maps Squarespace order data to a structured format for the Associates Program course
 */

import type { SquarespaceOrder, SquarespaceVariantOption } from "../types/squarespace.js";
import type { AssociatesProgramModel } from "../types/course.js";

/**
 * Checks if a course is an Associates Program course
 */
export function isAssociatesProgram(courseName: string | undefined | null): boolean {
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
 */
function extractLevel(section: string): string {
  return section.trim();
}

/**
 * Helper to get a variant option by name
 */
function getVariantOption(options: SquarespaceVariantOption[], key: string): string {
  const found = options.find(
    (opt) => opt.optionName.toLowerCase() === key.toLowerCase()
  );
  return found!.value;
}

/**
 * Creates a structured Associates Program course model from the order
 */
export function createAssociatesProgramModel(order: SquarespaceOrder): AssociatesProgramModel {
  const item = order.lineItems[0];
  const customizations = Object.fromEntries(
    item.customizations.map((c) => [c.label, c.value])
  );

  const plan = getVariantOption(item.variantOptions, "Plan");
  const section = getVariantOption(item.variantOptions, "Section");

  // Extract email from order and customizations
  const email = customizations["Email"] || order.customerEmail;

  // Extract name and split into first/last if available
  const fullName = customizations["Name"] || "";
  const nameParts = fullName.split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

  return {
    courseId: order.id,
    orderNumber: order.orderNumber,
    createdOn: order.createdOn,
    courseName: item.productName,
    courseType: "AssociatesProgram",
    customerEmail: email, // Keep this for the Firebase query

    studentInfo: {
      firstName,
      lastName,
      email, // This needs to match the customerEmail for consistency
      phone: customizations["Phone"]?.replace(/\s+/g, "") || "",
      gender: customizations["Gender"],
      age: customizations["Age"],
      studentType: customizations["I am a"],
      password: customizations["Password"],
    },

    placementInfo: {
      arabicProficiency: customizations["Arabic Proficiency"],
      readingAbility:
        customizations["How would you rate your Arabic reading ability?"],
      writingAbility:
        customizations["How would you rate your Arabic writing ability?"],
      listeningAbility:
        customizations[
          "How would you rate your Arabic listening and comprehension?"
        ],
      studiedIslamicSciences:
        customizations[
          "Have you studied Islamic sciences before (e.g. Aqeedah, Fiqh, Tafsir, Hadith)?"
        ],
      previousTopics:
        customizations[
          "If yes, please list some of the topics you've studied and where:"
        ],
    },

    programDetails: {
      plan,
      level: extractLevel(section),
      imageUrl: item.imageUrl,
      status: "enrolled",
    },

    metadata: {
      lastUpdated: new Date().toISOString(),
    },
  };
}
