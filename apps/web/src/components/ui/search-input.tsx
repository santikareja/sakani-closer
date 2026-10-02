import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/ssr/MagnifyingGlass";

export function SearchInput({
  name = "q",
  defaultValue,
  placeholder = "Cari...",
  label = "Cari",
}: {
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  label?: string;
}) {
  return (
    <label className="search-input">
      <span className="sr-only">{label}</span>
      <MagnifyingGlassIcon size={18} aria-hidden="true" />
      <input name={name} defaultValue={defaultValue} placeholder={placeholder} type="search" />
    </label>
  );
}
