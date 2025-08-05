import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App" // This import now correctly points to the re-exporting App.tsx
import "./index.css"

// Function to initialize the React application
function initializeApp() {
  const container = document.getElementById("root")

  if (!container) {
    // Log an error if the root element is not found
    console.error('Root element with id="root" not found in the DOM. Creating it dynamically.')
    // Dynamically create the root element if it doesn't exist
    const rootDiv = document.createElement("div")
    rootDiv.id = "root"
    document.body.appendChild(rootDiv)
    // Use the newly created div as the container
    const root = createRoot(rootDiv)
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  } else {
    // If the container exists, proceed with rendering
    const root = createRoot(container)
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  }
}

// Ensure the DOM is fully loaded before attempting to initialize the app
if (document.readyState === "loading") {
  // If the DOM is still loading, wait for the 'DOMContentLoaded' event
  document.addEventListener("DOMContentLoaded", initializeApp)
} else {
  // If the DOM is already loaded (e.g., script is deferred or at the end of body), initialize immediately
  initializeApp()
}
