/**
 * Prophetic Guidance Course Model
 * Converts Squarespace order data into a structured Prophetic Guidance course object.
 */

import type { SquarespaceOrder, SquarespaceVariantOption } from "../types/squarespace.js";
import type { PropheticGuidanceModel } from "../types/course.js";

/**
 * Checks if a course is an Associates Program course
 */
export function isPropheticGuidance(courseName: string | undefined | null): boolean {
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
 */
function extractModule(section: string): string {
  return section.toLowerCase().includes("module") ? section.trim() : "General";
}

/**
 * Retrieves a variant option value by name
 */
function getVariantOption(options: SquarespaceVariantOption[], key: string): string {
  const option = options.find(
    (opt) => opt.optionName.toLowerCase() === key.toLowerCase()
  );
  return option!.value;
}

/**
 * Builds the Prophetic Guidance course model from a Squarespace order
 */
export function createPropheticGuidanceModel(
  order: SquarespaceOrder,
  password?: string
): PropheticGuidanceModel {
  const item = order.lineItems[0];

  const [firstName, lastName, phone, email, gender, age, studentType] =
    item.customizations.map((c) => c.value);

  const plan = getVariantOption(item.variantOptions, "Plan");
  const section = getVariantOption(item.variantOptions, "Section");

  return {
    courseId: order.id,
    orderNumber: order.orderNumber,
    createdOn: order.createdOn,
    courseName: item.productName,
    courseType: "PropheticGuidance",

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
      imageUrl: item.imageUrl,
      status: "enrolled",
    },

    metadata: {
      lastUpdated: new Date().toISOString(),
    },
  };
}
