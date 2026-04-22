import { z } from 'zod';
import type { TemplateField } from '../types';

export type TFunction = (key: string, opts?: Record<string, unknown>) => string;

export const createValidationSchema = (
  fields: TemplateField[],
  t: TFunction
) => {
  const schemaFields: Record<string, z.ZodTypeAny> = {};

  fields.forEach((field) => {
    let fieldSchema: z.ZodTypeAny;

    switch (field.type) {
      case 'text':
      case 'textarea':
        fieldSchema = z.string();
        if (field.validation?.pattern) {
          fieldSchema = (fieldSchema as z.ZodString).regex(
            new RegExp(field.validation.pattern),
            field.validation.message || t('wizard.invalidFormat')
          );
        }
        break;

      case 'select':
        fieldSchema = z.string();
        if (field.options) {
          fieldSchema = z.enum(field.options as [string, ...string[]]);
        }
        break;

      case 'multiselect':
        fieldSchema = z.array(z.string());
        break;

      case 'checkbox':
        fieldSchema = z.boolean();
        break;

      default:
        fieldSchema = z.any();
    }

    // 필수 여부
    if (field.required) {
      if (field.type === 'text' || field.type === 'textarea') {
        fieldSchema = (fieldSchema as z.ZodString).min(
          1,
          t('wizard.fieldRequired', { label: field.label })
        );
      }
      schemaFields[field.name] = fieldSchema;
    } else {
      schemaFields[field.name] = fieldSchema.optional();
    }
  });

  return z.object(schemaFields);
};
