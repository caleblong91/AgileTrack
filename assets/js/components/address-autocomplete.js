/**
 * Address Autocomplete Module
 * 
 * Provides address autocomplete functionality using the Google Places API (beta version).
 * This module can be used across different pages where address input is needed.
 * 
 * @requires Google Maps JavaScript API with Places library
 */

class AddressAutocomplete {
  /**
   * Creates a new AddressAutocomplete instance
   * 
   * @param {Object} config - Configuration options
   * @param {string} config.inputId - ID of the address input field
   * @param {string} config.apiKey - Google Maps API key
   * @param {Object} [config.fields] - Optional field mappings for address components
   * @param {string} [config.fields.city] - ID of the city input field
   * @param {string} [config.fields.state] - ID of the state input field
   * @param {string} [config.fields.zipCode] - ID of the zip code input field
   * @param {Function} [config.onAddressSelected] - Callback function when an address is selected
   */
  constructor(config) {
    this.config = {
      inputId: config.inputId || 'address_line1',
      apiKey: config.apiKey,
      fields: {
        city: config.fields?.city || 'city',
        state: config.fields?.state || 'state',
        zipCode: config.fields?.zipCode || 'zip_code'
      },
      onAddressSelected: config.onAddressSelected || function() {}
    };
    
    this.addressInput = null;
    this.dropdownContainer = null;
    this.sessionToken = null;
    
    // Load the Google Maps API script
    this.loadScript();
  }
  
  /**
   * Load the Google Maps JavaScript API script
   */
  loadScript() {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${this.config.apiKey}&libraries=places&v=beta`;
    script.async = true;
    script.defer = true;
    
    script.onload = () => this.initialize();
    script.onerror = (error) => {
      console.error('Error loading Google Maps script:', error);
      this.handleError('Failed to load Google Maps API');
    };
    
    document.head.appendChild(script);
  }
  
  /**
   * Initialize the address autocomplete functionality
   */
  initialize() {
    try {
      this.addressInput = document.getElementById(this.config.inputId);
      
      if (!this.addressInput) {
        console.error(`Address input field with ID '${this.config.inputId}' not found`);
        return;
      }
      
      // Create a new session token
      this.refreshSessionToken();
      
      // Create dropdown container for predictions
      this.createDropdownContainer();
      
      // Add input event listener
      this.addressInput.addEventListener('input', this.handleInput.bind(this));
      
      // Close dropdown when clicking elsewhere
      document.addEventListener('click', this.handleDocumentClick.bind(this));
      
      // Prevent form submission on enter
      this.addressInput.addEventListener('keydown', this.handleKeyDown.bind(this));
      
      // Add styles for the predictions
      this.addStyles();
    } catch (error) {
      console.error('Error initializing Places Autocomplete:', error);
      this.handleError('Failed to initialize address autocomplete');
    }
  }
  
  /**
   * Create dropdown container for predictions
   */
  createDropdownContainer() {
    this.dropdownContainer = document.createElement('div');
    this.dropdownContainer.className = 'address-predictions';
    this.dropdownContainer.style.display = 'none';
    this.addressInput.parentNode.appendChild(this.dropdownContainer);
  }
  
  /**
   * Handle input event on address field
   * @param {Event} event - Input event
   */
  async handleInput(event) {
    if (event.target.value.length < 3) {
      this.dropdownContainer.style.display = 'none';
      return;
    }
    
    try {
      const request = {
        input: event.target.value,
        sessionToken: this.sessionToken,
        includedPrimaryTypes: ['street_address'],
        language: 'en',
        region: 'us'
      };
      
      // Fetch predictions using the AutocompleteSuggestion API
      const { suggestions } = await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
      
      // Display predictions
      this.displayPredictions(suggestions);
    } catch (error) {
      console.error('Error getting autocomplete predictions:', error);
      this.dropdownContainer.style.display = 'none';
    }
  }
  
  /**
   * Display predictions in the dropdown
   * @param {Array} suggestions - Array of prediction suggestions
   */
  displayPredictions(suggestions) {
    if (suggestions && suggestions.length > 0) {
      this.dropdownContainer.innerHTML = '';
      this.dropdownContainer.style.display = 'block';
      
      suggestions.forEach(suggestion => {
        if (suggestion.placePrediction) {
          const predictionItem = document.createElement('div');
          predictionItem.className = 'prediction-item';
          predictionItem.textContent = suggestion.placePrediction.text.toString();
          
          predictionItem.addEventListener('click', () => {
            this.handlePredictionClick(suggestion.placePrediction);
          });
          
          this.dropdownContainer.appendChild(predictionItem);
        }
      });
    } else {
      this.dropdownContainer.style.display = 'none';
    }
  }
  
  /**
   * Handle click on a prediction item
   * @param {Object} placePrediction - The place prediction object
   */
  async handlePredictionClick(placePrediction) {
    try {
      // Get the Place object from the prediction
      const place = placePrediction.toPlace();
      
      // Fetch place details
      await place.fetchFields({
        fields: ['displayName', 'formattedAddress', 'addressComponents']
      });
      
      // Update the input field
      this.addressInput.value = place.formattedAddress;
      
      // Create data object to pass to the callback
      const placeData = {
        address: place.formattedAddress,
        city: '',
        state: '',
        zipCode: ''
      };
      
      // Extract and populate address components
      if (place.addressComponents) {
        place.addressComponents.forEach(component => {
          const type = component.types[0];
          switch (type) {
            case 'locality':
              placeData.city = component.longText;
              const cityField = document.getElementById(this.config.fields.city);
              if (cityField) cityField.value = component.longText;
              break;
            case 'administrative_area_level_1':
              placeData.state = component.shortText;
              const stateField = document.getElementById(this.config.fields.state);
              if (stateField) stateField.value = component.shortText;
              break;
            case 'postal_code':
              placeData.zipCode = component.longText;
              const zipField = document.getElementById(this.config.fields.zipCode);
              if (zipField) zipField.value = component.longText;
              break;
          }
        });
      } else {
        console.warn('No address components found in place details');
      }
      
      // Hide the dropdown
      this.dropdownContainer.style.display = 'none';
      
      // Refresh session token for the next search
      this.refreshSessionToken();
      
      // Call the onAddressSelected callback with place data
      this.config.onAddressSelected(placeData);
    } catch (error) {
      console.error('Error handling place selection:', error);
      this.handleError('Failed to get place details');
    }
  }
  
  /**
   * Handle document click event (close dropdown when clicking outside)
   * @param {Event} event - Click event
   */
  handleDocumentClick(event) {
    if (this.dropdownContainer && 
        !this.addressInput.contains(event.target) && 
        !this.dropdownContainer.contains(event.target)) {
      this.dropdownContainer.style.display = 'none';
    }
  }
  
  /**
   * Handle key down event on the address input
   * @param {Event} event - Key down event
   */
  handleKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      
      // Select first prediction if dropdown is visible
      if (this.dropdownContainer.style.display === 'block' && 
          this.dropdownContainer.children.length > 0) {
        this.dropdownContainer.children[0].click();
      }
    }
  }
  
  /**
   * Refresh the session token
   */
  refreshSessionToken() {
    this.sessionToken = new google.maps.places.AutocompleteSessionToken();
  }
  
  /**
   * Handle errors
   * @param {string} message - Error message
   */
  handleError(message) {
    console.warn(message);
    if (this.addressInput) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'alert alert-warning mt-3';
      errorDiv.textContent = 'Address autocomplete is currently unavailable. Please enter your address manually.';
      this.addressInput.parentNode.appendChild(errorDiv);
    }
  }
  
  /**
   * Add styles for the address predictions dropdown
   */
  addStyles() {
    const styleId = 'address-autocomplete-styles';
    
    // Only add styles once
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        .address-predictions {
          position: absolute;
          z-index: 1000;
          background: white;
          border: 1px solid #ddd;
          border-top: none;
          max-height: 200px;
          overflow-y: auto;
          width: 100%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        .prediction-item {
          padding: 8px 12px;
          cursor: pointer;
        }
        .prediction-item:hover {
          background-color: #f5f5f5;
        }
      `;
      document.head.appendChild(style);
    }
  }
}

// Export the module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AddressAutocomplete;
} else {
  window.AddressAutocomplete = AddressAutocomplete;
} 