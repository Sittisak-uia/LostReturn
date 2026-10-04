'use client';
import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ..._props }: ToasterProps) => {
  return null;
};

export { Toaster, toast };

