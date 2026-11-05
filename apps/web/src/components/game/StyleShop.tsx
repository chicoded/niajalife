export interface StyleShopOption {
  id: string;
  label: string;
}

interface StyleShopProps {
  title: string;
  subtitle: string;
  options: StyleShopOption[];
  onSelect: (id: string) => void;
  onClose: () => void;
}

/**
 * The barber / boutique chooser. Picking an option sends an interaction; the
 * server validates proximity and applies the change, it is never applied here.
 */
export function StyleShop({ title, subtitle, options, onSelect, onClose }: StyleShopProps) {
  return (
    <div className="panel">
      <div className="prompt">
        <div>
          <div className="name">{title}</div>
          <div className="blurb">{subtitle}</div>
        </div>
        <button className="btn btn-sm" type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
      <div className="options" style={{ marginTop: 12 }}>
        {options.map((option) => (
          <button key={option.id} className="option" type="button" onClick={() => onSelect(option.id)}>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
