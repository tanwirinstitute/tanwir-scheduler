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

import { logger } from "../utils/logger.js";
import type { SquarespaceOrder } from "../types/squarespace.js";
import type { CourseModel } from "../types/course.js";

/**
 * Maps a single Squarespace order to its appropriate course model
 */
export function mapCourseToModel(order: SquarespaceOrder): CourseModel {
  const item = order?.lineItems?.[0];
  const courseName = item?.productName;

  if (!courseName) {
    logger.warn("Invalid course data provided to mapper");
    return order;
  }

  try {
    if (isAssociatesProgram(courseName)) {
      logger.info(`Mapping course "${courseName}" to Associates Program model`);
      return createAssociatesProgramModel(order);
    }

    if (isPropheticGuidance(courseName)) {
      logger.info(`Mapping course "${courseName}" to Prophetic Guidance model`);
      return createPropheticGuidanceModel(order); // password comes from order
    }

    logger.info(
      `Course "${courseName}" does not match any specific model, using generic format`
    );
    return {
      ...order,
      courseType: "Generic",
      metadata: {
        lastUpdated: new Date().toISOString(),
      },
    };
  } catch (error) {
    logger.error(`Error mapping course "${courseName}" to model:`, error);
    return order;
  }
}

export interface StudentRecordWithCourses {
  customerEmail?: string;
  courses: SquarespaceOrder[];
  [key: string]: unknown;
}

export interface MappedStudentRecord extends Omit<StudentRecordWithCourses, "courses"> {
  courses: CourseModel[];
}

/**
 * Maps all courses in a student record to their appropriate models
 */
export function mapStudentCourses(
  studentRecord: StudentRecordWithCourses
): StudentRecordWithCourses | MappedStudentRecord {
  if (!studentRecord || !Array.isArray(studentRecord.courses)) {
    return studentRecord;
  }

  try {
    const mappedCourses = studentRecord.courses.map(mapCourseToModel);

    return {
      ...studentRecord,
      courses: mappedCourses,
    };
  } catch (error) {
    logger.error(
      `Error mapping courses for student ${studentRecord.customerEmail}:`,
      error
    );
    return studentRecord;
  }
}
