export const COSTCO_GRAPHQL_URL =
  'https://ecom-api.costco.com/ebusiness/order/v1/orders/graphql';

/** List receipts within a date range */
export const RECEIPTS_LIST_QUERY = `
  query receiptsWithCounts($startDate: String!, $endDate: String!, $documentType: String!, $documentSubType: String!) {
    receiptsWithCounts(startDate: $startDate, endDate: $endDate, documentType: $documentType, documentSubType: $documentSubType) {
      inWarehouse
      receipts {
        warehouseName
        receiptType
        documentType
        transactionDateTime
        transactionBarcode
        transactionType
        total
        totalItemCount
        itemArray {
          itemNumber
        }
        tenderArray {
          tenderTypeCode
          tenderDescription
          amountTender
        }
      }
    }
  }
`;

/** Get full receipt detail by barcode */
export const RECEIPT_DETAIL_QUERY = `
  query receiptsWithCounts($barcode: String!, $documentType: String!) {
    receiptsWithCounts(barcode: $barcode, documentType: $documentType) {
      receipts {
        warehouseName
        receiptType
        documentType
        transactionDateTime
        transactionDate
        transactionBarcode
        transactionType
        total
        subTotal
        taxes
        totalItemCount
        itemArray {
          itemNumber
          itemDescription01
          itemDescription02
          unit
          amount
          itemUnitPriceAmount
        }
        tenderArray {
          tenderTypeCode
          tenderDescription
          amountTender
        }
      }
    }
  }
`;

export interface CostcoReceiptsListResponse {
  data: {
    receiptsWithCounts: {
      inWarehouse: number;
      receipts: CostcoReceiptSummary[];
    };
  };
}

export interface CostcoReceiptSummary {
  warehouseName: string;
  receiptType: string;
  documentType: string;
  transactionDateTime: string;
  transactionBarcode: string;
  transactionType: string;
  total: number;
  totalItemCount: number;
}

export interface CostcoReceiptDetailResponse {
  data: {
    receiptsWithCounts: {
      receipts: CostcoReceiptDetail[];
    };
  };
}

export interface CostcoReceiptDetail {
  warehouseName: string;
  transactionDateTime: string;
  transactionDate: string;
  transactionBarcode: string;
  total: number;
  subTotal: number;
  taxes: number;
  totalItemCount: number;
  itemArray: CostcoLineItem[];
  tenderArray: CostcoTender[];
}

export interface CostcoLineItem {
  itemNumber: string;
  itemDescription01: string;
  itemDescription02: string;
  unit: number;
  amount: number;
  itemUnitPriceAmount: number;
}

export interface CostcoTender {
  tenderTypeCode: string;
  tenderDescription: string;
  amountTender: number;
}
