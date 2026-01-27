
// Configuration Constants (Relative Ratios)
export const CONFIG = {
  MIN_PI_VALUE: 300,
  
  // Grid Structure Ratios (relative to avgColDist)
  CELL_WIDTH_RATIO: 0.93,
  CELL_HEIGHT_RATIO: 1.16,
  
  // Anchor Offsets (relative to avgColDist)
  PI_OFFSET_X_RATIO: 0.20, 
  PI_OFFSET_Y_RATIO: 0.065,

  // Crop Regions (relative to Cell Width/Height)
  CLASS_ICON_RATIO: {
    x: 0.04,    
    y: 0.82,    
    width: 0.16, 
    height: 0.14 
  },

  ASCENSION_ICON_RATIO: {
    x: 0.78,    
    y: 0.84,    
    width: 0.16, 
    height: 0.10
  },

  PORTRAIT_RATIO: {
    x: 0.28,   
    y: 0.18,   
    width: 0.44, 
    height: 0.4 
  },

  // Region to sample for Star Level detection (Star Row)
  STARS_CHECK_RATIO: {
    x: 0.02,
    y: 0.64, 
    width: 0.96,
    height: 0.05
  },

  // Crop to apply to the reference champion image (p_128)
  REFERENCE_PORTRAIT_CROP: {
    x: 0.265,    
    y: 0.15,    
    width: 0.47,
    height: 0.65
  },

  // Recognition Thresholds
  CLASS_RMSE_THRESHOLD: 80, 
  CHAMPION_MATCH_THRESHOLD: 90,
};
