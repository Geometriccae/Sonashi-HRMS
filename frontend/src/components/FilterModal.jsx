import React from "react";
import "./FilterModal.css";

const FilterModal = ({ isOpen, onClose, onFilterSelect }) => {
  if (!isOpen) return null;

  const filterOptions = [
    {
      id: "company-name",
      label: "Company Name",
      hasIcon: true,
      isHighlighted: true,
      fontWeight: "bold"
    },
    {
      id: "assigned-to",
      label: "Assigned to",
      hasIcon: false,
      isHighlighted: false,
      fontWeight: "normal"
    },
    {
      id: "categories",
      label: "Categories",
      hasIcon: false,
      isHighlighted: false,
      fontWeight: "normal"
    },
    {
      id: "phone-number",
      label: "Phone Number",
      hasIcon: true,
      isHighlighted: true,
      fontWeight: "bold"
    },
    {
      id: "type",
      label: "Type",
      hasIcon: false,
      isHighlighted: false,
      fontWeight: "normal"
    },
    {
      id: "added-on",
      label: "Added on",
      hasIcon: false,
      isHighlighted: false,
      fontWeight: "normal"
    }
  ];

  const handleOptionClick = (option) => {
    if (onFilterSelect) {
      onFilterSelect(option);
    }
    onClose();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="filter-modal-backdrop" onClick={handleBackdropClick}>
      <div className="filter-modal-container">
        <div className="filter-dropdown-list">
          {filterOptions.map((option, index) => (
            <React.Fragment key={option.id}>
              <div 
                className={`filter-list-item ${option.isHighlighted ? 'highlighted' : ''}`}
                onClick={() => handleOptionClick(option)}
              >
                <div className="filter-item-state-layer">
                  <div className={`filter-item-background ${option.isHighlighted ? 'highlighted-bg' : 'normal-bg'}`} />
                </div>
                <div className="filter-item-content">
                  <div className="filter-item-icon">
                    {option.hasIcon ? (
                      <img
                        src="https://api.builder.io/api/v1/image/assets/TEMP/d129c03eda82821d7df2d66d73714b3e8b9ad428?placeholderIfAbsent=true&apiKey=0fcd4f274d044277b0fae139470e27f9"
                        alt=""
                        className="filter-option-icon"
                      />
                    ) : (
                      <div className="filter-check-icon" />
                    )}
                  </div>
                  <div className="filter-item-text">
                    <div className={`filter-option-label ${option.fontWeight === 'bold' ? 'bold-text' : 'normal-text'}`}>
                      {option.label}
                    </div>
                  </div>
                </div>
                {index < filterOptions.length - 1 && (
                  <div className="filter-item-divider">
                    <div className={`filter-divider-line ${option.isHighlighted ? 'highlighted-divider' : 'normal-divider'}`} />
                  </div>
                )}
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FilterModal;
