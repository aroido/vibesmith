import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import type { Control, FieldValues } from 'react-hook-form';
import type { TemplateField } from '../types';

interface FieldRendererProps {
  field: TemplateField;
  control: Control<FieldValues>;
}

export const FieldRenderer: React.FC<FieldRendererProps> = ({ field, control }) => {
  const { t } = useTranslation('components');

  return (
    <FormField
      control={control}
      name={field.name}
      render={({ field: formField }) => (
        <FormItem>
          <FormLabel>
            {field.label}
            {field.required && <span className="text-theme-danger ml-1">*</span>}
          </FormLabel>
          <FormControl>
            {field.type === 'text' && (
              <Input {...formField} placeholder={field.placeholder} />
            )}

            {field.type === 'textarea' && (
              <Textarea
                {...formField}
                placeholder={field.placeholder}
                rows={4}
              />
            )}

            {field.type === 'select' && (
              <Select
                onValueChange={formField.onChange}
                defaultValue={
                  typeof formField.value === 'string'
                    ? formField.value
                    : typeof field.default === 'string'
                      ? field.default
                      : undefined
                }
              >
                <SelectTrigger aria-label={field.label ? undefined : t('wizard.selectPlaceholder')}>
                  <SelectValue placeholder={t('wizard.selectPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {field.options?.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {field.type === 'multiselect' && (
              <div className="space-y-2">
                {field.options?.map((option) => (
                  <div key={option} className="flex items-center space-x-2">
                    <Checkbox
                      checked={
                        Array.isArray(formField.value) &&
                        formField.value.includes(option)
                      }
                      onCheckedChange={(checked) => {
                        const current = Array.isArray(formField.value)
                          ? (formField.value as string[])
                          : [];
                        if (checked) {
                          formField.onChange([...current, option]);
                        } else {
                          formField.onChange(
                            current.filter((v) => v !== option)
                          );
                        }
                      }}
                    />
                    <label className="text-sm">{option}</label>
                  </div>
                ))}
              </div>
            )}

            {field.type === 'checkbox' && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  checked={formField.value === true}
                  onCheckedChange={formField.onChange}
                />
                <label className="text-sm">{field.label}</label>
              </div>
            )}
          </FormControl>
          {field.help_text && <FormDescription>{field.help_text}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
};
