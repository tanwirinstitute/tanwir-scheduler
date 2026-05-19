/**
 * Course Mapper Utility
 * Maps course data from Squarespace orders to the appropriate course model
 */

import {
  createAssociatesProgramModel,
  isAssociatesProgram,
} from "./AssociatesProgram.js";

import {
  createPropheticGuidanceModel,
  isPropheticGuidance,
} from "./PropheticGuidance.js";

import {
  createBadrProgramModel,
  isBadrProgram,
} from "./BadrProgram.js";

import {
  createAnnualArafatProgramModel,
  isAnnualArafatProgram,
} from "./AnnualArafatProgram.js";

import { logger } from "../utils/logger.js";

/**
 * Maps a single Squarespace order to its appropriate course model(s)
 * @param {Object} order - Full Squarespace order object
 * @returns {Array} - Array of mapped course objects for all course types in the order
 */
export function mapCourseToModel(order) {
  if (!order?.lineItems?.length) {
    logger.warn("Invalid order data provided to mapper");
    return null;
  }

  // Group line items by product name
  const coursesByType = {};
  order.lineItems.forEach(item => {
    if (item.lineItemType === "SERVICE" && item.productName) {
      if (!coursesByType[item.productName]) {
        coursesByType[item.productName] = [];
      }
      coursesByType[item.productName].push(item);
    }
  });

  // Process each course type separately
  const allMappedCourses = [];
  
  // Create a clone of the order for each course type
  for (const [courseName, items] of Object.entries(coursesByType)) {
    try {
      // Create a modified order with only the line items for this course type
      const courseOrder = {
        ...order,
        lineItems: items
      };
      
      let mappedCourses = [];
      
      if (isAssociatesProgram(courseName)) {
        logger.info(`Mapping course "${courseName}" to Associates Program model`);
        mappedCourses = createAssociatesProgramModel(courseOrder); // Returns an array
      } else if (isPropheticGuidance(courseName)) {
        logger.info(`Mapping course "${courseName}" to Prophetic Guidance model`);
        mappedCourses = createPropheticGuidanceModel(courseOrder); // Returns an array
      } else if (isBadrProgram(courseName)) {
        logger.info(`Mapping course "${courseName}" to Badr Program model`);
        mappedCourses = createBadrProgramModel(courseOrder); // Returns an array
      } else if (isAnnualArafatProgram(courseName)) {
        logger.info(`Mapping course "${courseName}" to Annual Arafat Program model`);
        mappedCourses = createAnnualArafatProgramModel(courseOrder); // Returns an array
      } else {
        logger.info(`Course "${courseName}" does not match any specific model, using generic format`);
        // Handle generic course (if needed)
        continue;
      }
      
      // Ensure we always have an array
      if (!Array.isArray(mappedCourses)) {
        mappedCourses = [mappedCourses];
      }
      
      // Add all mapped courses to the result array
      allMappedCourses.push(...mappedCourses);
    } catch (error) {
      logger.error(`Error mapping course "${courseName}":`, error);
    }
  }
  
  return allMappedCourses;
}

/**
 * Maps all courses in a student record to their appropriate models
 * @param {Object} studentRecord - Student record containing a `courses` array of orders
 * @returns {Object} - Student record with mapped courses
 */
export function mapStudentCourses(studentRecord) {
  if (!studentRecord || !studentRecord.courses) {
    return studentRecord;
  }

  const mappedCourses = studentRecord.courses.map((course) => {
    try {
      const mapped = mapCourseToModel({ ...course, lineItems: [course] });
      return mapped || course;
    } catch (error) {
      logger.error(`Error mapping student course:`, error);
      return course;
    }
  });

  return {
    ...studentRecord,
    courses: mappedCourses,
  };
}
