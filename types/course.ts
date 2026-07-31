import type { SquarespaceOrder } from "./squarespace.js";

export interface StudentInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  gender?: string;
  age?: string;
  studentType?: string;
  password?: string;
}

export interface PlacementInfo {
  arabicProficiency?: string;
  readingAbility?: string;
  writingAbility?: string;
  listeningAbility?: string;
  studiedIslamicSciences?: string;
  previousTopics?: string;
}

export interface ProgramDetails {
  plan: string;
  level: string;
  imageUrl?: string;
  status: string;
}

export interface GuidanceDetails {
  module: string;
  plan: string;
  imageUrl?: string;
  status: string;
}

export interface CourseMetadata {
  lastUpdated: string;
}

export interface AssociatesProgramModel {
  courseId: string;
  orderNumber: string;
  createdOn: string;
  courseName: string;
  courseType: "AssociatesProgram";
  customerEmail: string;
  studentInfo: StudentInfo;
  placementInfo: PlacementInfo;
  programDetails: ProgramDetails;
  metadata: CourseMetadata;
}

export interface PropheticGuidanceModel {
  courseId: string;
  orderNumber: string;
  createdOn: string;
  courseName: string;
  courseType: "PropheticGuidance";
  studentInfo: StudentInfo;
  guidanceDetails: GuidanceDetails;
  metadata: CourseMetadata;
}

export type GenericCourseModel = SquarespaceOrder & {
  courseType: "Generic";
  metadata: CourseMetadata;
};

/**
 * mapCourseToModel falls back to returning the raw order unchanged when
 * course data is invalid or mapping throws, so the raw order type stays
 * part of the union.
 */
export type CourseModel =
  | AssociatesProgramModel
  | PropheticGuidanceModel
  | GenericCourseModel
  | SquarespaceOrder;
