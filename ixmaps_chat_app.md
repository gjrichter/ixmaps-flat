# ixMaps Chat App - AI-Assisted Map Creation


## What is it?

The ixMaps Chat App is an **AI-assisted** interactive mapping and data visualization tool that helps you create maps through natural language conversation. It combines the power of interactive mapping with artificial intelligence to make data visualization more intuitive and accessible.

### AI Integration

The Chat App works with two AI providers that you can configure in the Settings:

- **Gemini AI** (Google) - Primary AI assistant for data analysis and natural language queries
- **Mistral AI** - Free alternative that can be used as a fallback or for all queries

You can configure both AI providers in the Settings (⚙️) by:
1. Entering your API keys (Gemini API key from Google AI Studio, or Mistral API key from console.mistral.ai)
2. Enabling the AI providers you want to use
3. Choosing your preferred language for responses (for Mistral)

The AI assistant helps you:
- Analyze and understand your data structure
- Answer questions about your data in natural language
- Create data visualizations through conversation
- Get insights and recommendations

### Key Features

- **Natural Language Interface**: Ask questions and give commands in plain English (or other languages)
- **Multiple Data Formats**: Load CSV, JSON, GeoJSON, TopoJSON, Parquet, GeoParquet, GeoPackage, FlatGeobuf, Geobuf
- **Interactive Data Exploration**: Query and filter data using natural language
- **Visual Data Analysis**: Automatically visualize query results on the map
- **Customizable Themes**: Create and customize data visualization themes
- **Project Export**: Save your work as reusable HTML pages or JSON project files


## Typical Workflow

### 1. Load Data

Start by loading your data into the application. You can:

- **Load from URL**: Type `load data url [URL]` or simply paste a URL into the chat
- **Use Sample Data**: Ask "show me some sample data" to see example datasets
- **Supported Formats**: The app supports CSV, JSON, GeoJSON, TopoJSON, Parquet, GeoParquet, GeoPackage, FlatGeobuf, and Geobuf formats

When data is loaded, the AI automatically analyzes it and provides an introduction explaining:
- The data structure
- Available fields and columns
- Data types and sample values
- Suggestions for visualization

### 2. Explore Data

Once your data is loaded, you can explore it using natural language queries:

- **Ask Questions**: 
  - "What data is available?"
  - "Show me all features"
  - "Find countries with population over 1000000"
  - "What are the data fields?"

- **Query and Filter**:
  - Ask specific questions about your data
  - Filter data based on criteria
  - The AI will understand your intent and help you explore the data

- **Visual Exploration**:
  - Query results are automatically visualized on the map
  - Interact with the map to see details
  - Use the chat to refine your queries

### 3. Create and Customize Data Theme

After exploring your data, you can create visualizations (themes) on the map. The Chat App offers **two ways to interact** when creating and customizing themes:

- **Natural Language Interaction**:
  - Ask the AI to create a theme for your data
    - Example: "Create a choropleth map showing population"
    - Example: "Make a bubble chart for city sizes"
  - Customize appearance through conversation
    - Adjust colors, opacity, and styling by describing what you want
    - Configure tooltips with custom templates
    - Set visualization types (choropleth, bubble, pie charts, etc.)
    - Modify legends and labels

- **Dedicated Theme Edit and Config Tools**:
  - Use the built-in theme editor for precise control
  - Access configuration panels for detailed customization
  - Edit theme properties directly through visual interfaces
  - Fine-tune styling options with dedicated controls

- **Multiple Themes**: You can add multiple data layers to the same map for comparison

### 4. Save Map Project or Reusable HTML Page

Once you're satisfied with your map, you can save your work:

- **View and Control HTML Code**:
  - Type `show code` in the chat to view the HTML code for the actual map
  - See the generated code that creates your map visualization
  - Copy and edit the code directly if needed
  - Understand how your map is structured in code

- **Save as HTML**: 
  - Creates a standalone, reusable HTML page
  - Includes all map configuration and themes
  - Can be shared or embedded in other websites
  - No dependencies on the Chat App

- **Save as JSON Project**:
  - Exports the map project configuration as JSON
  - Can be loaded later to continue editing
  - Useful for version control and collaboration

- **Undo/Redo**: The app maintains a history of changes, allowing you to undo and redo modifications


## Getting Started

1. Open the Chat App in your browser
2. Configure AI settings (⚙️) if you want AI assistance (optional but recommended)
3. Load your data by pasting a URL or using sample data
4. Start exploring and creating visualizations through conversation
5. Save your work when ready

The Chat App makes map creation accessible to everyone, whether you're a data analyst, researcher, or just curious about visualizing your data!
