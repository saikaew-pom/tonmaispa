// Zod schemas — validate at every API boundary before touching Supabase
import { z } from 'zod'

export const enquirySchema = z.object({
  name:            z.string().min(2, 'Name is required').max(100),
  email:           z.string().email('Invalid email').optional().or(z.literal('')),
  phone:           z.string().min(7, 'Phone number required').max(20),
  message:         z.string().max(1000).optional(),
  turnstileToken:  z.string().min(1, 'Security check required'),
})

export const bookingSchema = z.object({
  guest_name:     z.string().min(2).max(100),
  guest_email:    z.string().email().optional().or(z.literal('')),
  guest_phone:    z.string().min(7).max(20),
  treatment_id:   z.string().uuid('Invalid treatment'),
  therapist_id:   z.string().uuid().optional(),
  date:           z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  time_slot:      z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time'),
  duration:       z.number().int().min(30).max(480),
  // Ids only — every add-on's minutes and price are re-read server-side
  // (lib/booking-addons.js). Format check here; existence/eligibility there.
  addon_ids:      z.array(z.string().uuid()).max(5).optional(),
  notes:          z.string().max(500).optional(),
  turnstileToken: z.string().min(1, 'Security check required'),
})

export const chatMessageSchema = z.object({
  messages:  z.array(z.object({
    role:    z.enum(['user', 'assistant']),
    content: z.string().max(4000),
  })).min(1).max(40),
  sessionId: z.string().uuid('Invalid session'),
})

export const siteContentSchema = z.object({
  key:        z.string().min(1).max(200),
  value_text: z.string().max(5000).optional(),
  value_rich: z.string().max(50000).optional(),
  page:       z.string().max(50),
  section:    z.string().max(50).optional(),
})

export const treatmentSchema = z.object({
  name:             z.string().min(2).max(200),
  slug:             z.string().min(2).max(200),
  description:      z.string().max(1000).optional(),
  category:         z.string().max(100),
  duration_options: z.array(z.number().int().positive()).default([60]),
  prices:           z.record(z.string(), z.number().positive()),
  badge:            z.string().max(50).optional(),
  sort_order:       z.number().int().default(0),
  is_active:        z.boolean().default(true),
})

export const menuItemSchema = z.object({
  category_id:    z.string().uuid(),
  name:           z.string().min(2).max(200),
  description:    z.string().max(500).optional(),
  price:          z.number().positive().optional(),
  price_note:     z.string().max(100).optional(),
  badge:          z.string().max(50).optional(),
  tags:           z.array(z.string()).default([]),
  is_recommended: z.boolean().default(false),
  is_active:      z.boolean().default(true),
  sort_order:     z.number().int().default(0),
})

export const blockDateSchema = z.object({
  date:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  therapist_id: z.string().uuid().optional(),
  reason:       z.string().max(200).optional(),
})
