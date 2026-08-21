import { z } from 'zod';

import { isoDateTime } from './api';
import { paymentRailSchema, verificationModeSchema, type PaymentRail } from './enums';

export const paymentMethodSchema = z.looseObject({
  id: z.string(),
  code: z.string(),
  displayName: z.string(),
  rail: paymentRailSchema,
  currencyCode: z.string(),
  verificationMode: verificationModeSchema,
  minAmount: z.string(),
  maxAmount: z.string(),
  feeFixed: z.string(),
  feeBps: z.number(),
  requiresReference: z.boolean(),
  instructions: z.string().nullable(),
  requiredProofFields: z.array(z.unknown()).optional(),
  isActive: z.boolean(),
  sortOrder: z.number(),
  referencePattern: z.string().nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const paymentDestinationSchema = z.looseObject({
  id: z.string(),
  label: z.string(),
  accountIdentifier: z.string(),
  accountHolder: z.string().nullable(),
  notes: z.string().nullable(),
  paymentMethodId: z.string(),
  isActive: z.boolean(),
  priority: z.number(),
  dailyCap: z.string().nullable(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});
export type PaymentDestination = z.infer<typeof paymentDestinationSchema>;

export interface PaymentMethodListQuery {
  isActive?: boolean;
  rail?: PaymentRail;
}

export interface CreatePaymentMethodBody {
  code: string;
  displayName: string;
  rail: PaymentRail;
  currencyCode: string;
  verificationMode: z.infer<typeof verificationModeSchema>;
  minAmount: string;
  maxAmount: string;
  feeFixed?: string;
  feeBps?: number;
  requiresReference?: boolean;
  referencePattern?: string;
  instructions?: string;
  isActive?: boolean;
  sortOrder?: number;
}

/** `code`, `rail` and `currencyCode` are immutable — reinterpreting them would rewrite history. */
export type UpdatePaymentMethodBody = Partial<
  Omit<CreatePaymentMethodBody, 'code' | 'rail' | 'currencyCode'>
>;

export interface CreatePaymentDestinationBody {
  label: string;
  accountIdentifier: string;
  accountHolder?: string;
  isActive?: boolean;
  priority?: number;
  dailyCap?: string;
  notes?: string;
}

/** The account number itself cannot be edited: that would silently redirect players' money. */
export type UpdatePaymentDestinationBody = Partial<
  Omit<CreatePaymentDestinationBody, 'accountIdentifier'>
>;
