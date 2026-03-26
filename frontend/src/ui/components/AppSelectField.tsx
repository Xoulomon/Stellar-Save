import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  type SelectProps,
} from "@mui/material";

export interface SelectOption {
  value: string;
  label: string;
}

export interface AppSelectFieldProps extends Omit<SelectProps, "label"> {
  label: string;
  id: string;
  options: SelectOption[];
}

export function AppSelectField({
  label,
  id,
  options,
  value,
  ...props
}: AppSelectFieldProps) {
  return (
    <FormControl fullWidth>
      <InputLabel id={`${id}-label`}>{label}</InputLabel>
      <Select
        labelId={`${id}-label`}
        id={id}
        label={label}
        value={value}
        {...props}
      >
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            {option.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
