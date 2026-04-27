import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

interface SearchInputProps {
  placeholder?: string;
  className?: string;
  variant?: "default" | "compact";
}

const SearchInput = ({ 
  placeholder = "¿Qué quieres pedir hoy?", 
  className = "",
  variant = "default"
}: SearchInputProps) => {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const navigate = useNavigate();

  const handleSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (query.trim()) {
      navigate(`/negocios?q=${encodeURIComponent(query.trim())}`);
    } else {
      navigate("/negocios");
    }
  };

  const isCompact = variant === "compact";

  return (
    <form 
      onSubmit={handleSearch}
      className={`relative group ${isCompact ? "max-w-md" : "max-w-2xl"} w-full ${className}`}
    >
      <div className={`absolute inset-y-0 left-4 flex items-center pointer-events-none`}>
        <Search className={`${isCompact ? "h-4 w-4" : "h-5 w-5"} text-muted-foreground group-focus-within:text-primary transition-colors`} />
      </div>
      <Input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className={`${isCompact ? "pl-11 pr-4 h-10 text-sm rounded-xl" : "pl-11 sm:pl-12 pr-24 sm:pr-32 h-12 sm:h-14 text-sm sm:text-lg rounded-2xl"} border-border/60 bg-card/50 backdrop-blur-sm shadow-card hover:shadow-glow focus:shadow-glow focus:ring-primary/20 transition-all`}
      />
      {!isCompact && (
        <div className="absolute inset-y-1.5 right-1.5 flex items-center">
          <button 
            type="submit"
            className="h-full px-4 sm:px-6 rounded-xl bg-gradient-hero text-primary-foreground font-semibold text-sm sm:text-base shadow-soft hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Buscar
          </button>
        </div>
      )}
    </form>
  );
};

export default SearchInput;
