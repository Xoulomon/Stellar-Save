import {
  Button,
  type ButtonProps,
} from "@mui/material";

export type AppButtonProps = ButtonProps;

export function AppButton(props: AppButtonProps) {
  return <Button size="medium" {...props} />;
}
