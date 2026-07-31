/**
 * Squarespace order payload shapes are not formally documented; these are
 * inferred from actual API responses and kept loose (unknown extra fields
 * allowed) rather than fully strict.
 */

export interface SquarespaceCustomization {
  label: string;
  value: string;
}

export interface SquarespaceVariantOption {
  optionName: string;
  value: string;
}

export interface SquarespaceLineItem {
  lineItemType: string;
  productName: string;
  imageUrl?: string;
  customizations: SquarespaceCustomization[];
  variantOptions: SquarespaceVariantOption[];
  [key: string]: unknown;
}

export interface SquarespaceOrder {
  id: string;
  orderNumber: string;
  createdOn: string;
  customerEmail: string;
  lineItems: SquarespaceLineItem[];
  [key: string]: unknown;
}

export interface SquarespacePagination {
  nextPageCursor?: string | null;
}

export interface SquarespaceOrdersResponse {
  result?: SquarespaceOrder[];
  pagination?: SquarespacePagination;
}
