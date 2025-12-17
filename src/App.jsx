import { useEffect, useState, useMemo } from "react";
import {
  Box, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, Typography, Fade, Button, MenuItem, FormControl,
  Select, InputLabel, Dialog, DialogTitle, DialogContent,
  DialogActions, Link, Switch, FormControlLabel, TablePagination, AppBar,
  Toolbar, TextField, Snackbar, Alert, CircularProgress, DialogContentText
} from "@mui/material";
import { styled, createTheme, ThemeProvider } from "@mui/material/styles";

// Hardcoded user data for login (for demonstration purposes)
const USERS = [
  { username: "01815128906", password: "Abc1234#" },
  { username: "01816645450", password: "FB1234d@ta" },
  { username: "01811309143", password: "Abc9876#" },
  { username: "01814371275", password: "Abc4321#" },
];

// Define API key (left blank for runtime injection) and URL
const apiKey = ""; 
const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

// Styled TableCell for header
const StyledTableCell = styled(TableCell)(({ theme }) => ({
  fontWeight: 600,
  color: theme.palette.primary.contrastText,
  backgroundColor: theme.palette.primary.main,
  padding: '10px 8px', // Adjusted padding for better fit
  whiteSpace: 'nowrap',
}));

// Animated TableRow for hover effect
const AnimatedRow = styled(TableRow)(({ theme }) => ({
  transition: "all 0.3s ease",
  cursor: "pointer",
  "&:hover": {
    backgroundColor: theme.palette.action.hover,
    transform: "scale(1.01)",
    boxShadow: theme.shadows[1],
  },
}));

/**
 * Fetches data from a Google Sheet and parses it into an array of objects.
 * @param {string} sheetId - The ID of the Google Sheet.
 * @param {string} sheetName - The name of the sheet within the Google Sheet.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of row objects.
 */
const fetchSheet = async (sheetId, sheetName) => {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${sheetName}`;
  const res = await fetch(url);
  const text = await res.text();
  // Google Sheets API returns a JSONP-like response, so we need to parse it.
  const json = JSON.parse(text.substring(47).slice(0, -2));
  const cols = json.table.cols.map((c) => c.label);
  const rows = json.table.rows.map((row) => {
    const obj = {};
    row.c.forEach((cell, i) => {
      obj[cols[i]] = cell?.v || "";
    });
    return obj;
  });
  return rows;
};

/**
 * Sanitizes phone number to WhatsApp format (Country Code + Number, no leading 0).
 * Assumes Bangladesh country code '880'.
 * @param {string} phone - The raw phone number (e.g., '018...').
 * @returns {string|null} The sanitized number (e.g., '88018...') or null if invalid.
 */
const sanitizePhoneForWhatsApp = (phone) => {
  if (!phone) return null;
  
  // 1. Remove all non-digit characters and spaces aggressively
  let rawPhone = phone.toString().trim().replace(/[^0-9]/g, ''); 

  // 2. Normalize by removing common country codes or leading zeros if they exist.
  // Strip '880', '0', or '+880' if found at the beginning.
  if (rawPhone.startsWith('880')) {
      rawPhone = rawPhone.substring(3); // Remove 880
  }
  if (rawPhone.startsWith('0')) {
      rawPhone = rawPhone.substring(1); // Remove leading 0
  }

  // 3. Reconstruct the full international number: '880' + 10-digit mobile number
  const finalNumber = '880' + rawPhone;
  
  // 4. Stricter Validation: The final number must be exactly 13 digits (880 + 10 digits)
  if (finalNumber.length === 13) {
      return finalNumber;
  }

  return null; // Invalid number format/length
};

/**
 * Generates the default, fixed collection message.
 */
const getDefaultMessage = (row) => {
    //const name = row.PPPoE_Name || 'Valued Client';
    // Use the calculated balance stored in the 'balance' field (e.g., "1500 TK")
    const amount = row.balance || '0 TK'; 
    return `প্রিয় গ্রাহক, আপনাকে জানানো যাচ্ছে যে আপনার মোট বকেয়ার পরিমাণ ${amount}. নিরবচ্ছিন্ন সংযোগ নিশ্চিত করতে দ্রুত পেমেন্ট সম্পন্ন করুন। আপনার সহযোগিতার জন্য ধন্যবাদ। -ফরহাদনগর ব্রডব্যান্ড ইন্টারনেট`;
};

function App() {
  const [results, setResults] = useState([]);
  const [filteredResults, setFilteredResults] = useState([]);
  const [filter, setFilter] = useState({ December: "", November: "", October: "", Area: "", Balance: "" });
  const [summary, setSummary] = useState({ December: 0, November: 0, October: 0 });
  const [selectedRow, setSelectedRow] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(100);
  
  // States for login, loading, and searching
  const [isLoggedIn, setIsLoggedIn] = useState(() => sessionStorage.getItem("isLoggedIn") === "true");
  const [loginInfo, setLoginInfo] = useState({ username: "", password: "" });
  const [searchId, setSearchId] = useState("");
  const [isLoading, setIsLoading] = useState(false); // Data loading state

  // Gemini API States
  const [customMessage, setCustomMessage] = useState("");
  const [isGeneratingMessage, setIsGeneratingMessage] = useState(false);

  // States for bulk notification feature
  const [bulkNotificationList, setBulkNotificationList] = useState([]);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);

  // States for Snackbar (replacing alert())
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "info",
  });

  // Google Sheet ID
  const sheetId = "1LYAKchZIX6qhGqBh4AxrkJU_4bGNMEJgegHHq-kYZwA";
  
  /**
   * Helper function to safely extract a number (positive or negative) from a string.
   * This handles strings like "1500 TK" or "-500".
   */
  const parseNumericValue = (str) => {
    if (!str) return 0;
    // Remove all non-digit, non-dot, non-minus characters.
    const cleanedStr = str.toString().replace(/[^\d.-]/g, ''); 
    const value = parseFloat(cleanedStr);
    return isNaN(value) ? 0 : value;
  };

  // Function to show Snackbar
  const showSnackbar = (message, severity = "info") => {
    setSnackbar({ open: true, message, severity });
  };

  /**
   * Handles user login.
   */
  const handleLogin = () => {
    const match = USERS.find(
      (user) => user.username === loginInfo.username && user.password === loginInfo.password
    );
    if (match) {
      setIsLoggedIn(true);
      sessionStorage.setItem("isLoggedIn", "true");
      showSnackbar("Login successful!", "success");
    } else {
      showSnackbar("Invalid credentials. Please check your username and password.", "error");
    }
  };

  /**
   * Handles user logout.
   */
  const handleLogout = () => {
    sessionStorage.removeItem("isLoggedIn");
    setIsLoggedIn(false);
    setLoginInfo({ username: "", password: "" });
    setResults([]);
    setFilteredResults([]);
    showSnackbar("Logged out successfully.", "info");
  };

  /**
   * Loads data from Google Sheets and applies the user's custom calculation logic.
   */
  const handleLoadData = async () => {
    setIsLoading(true);
    try {
      const [sheet1, sheet2, sheet3] = await Promise.all([
        fetchSheet(sheetId, "sheet1"),
        fetchSheet(sheetId, "sheet2"),
        fetchSheet(sheetId, "sheet3"),
      ]);

      const sheet2Ids = new Set(sheet2.map((r) => r.customer_id));
      const sheet3Ids = new Set(sheet3.map((r) => r.customer_id));

      const final = sheet1.map((row, index) => {
        const customer_id = row.customer_id;
        const PPPoE_Name = row.PPPoE_Name || "-";
        const area = row.area || "-";
        const client_phone = row.client_phone || "";

        // 1. Safely parse balance (ledger amount) and selling_bdt
        const raw_balance_value = parseNumericValue(row.balance);
        const selling_bdt = parseNumericValue(row.selling_bdt); // Assuming 'selling_bdt' column exists

        let total_due;

        // 2. Apply the user's custom calculation logic
        if (raw_balance_value < 0) {
          total_due = Math.abs(raw_balance_value) + selling_bdt;
        } else {
          total_due = selling_bdt - raw_balance_value;
        }
        
        // 3. Ensure Total Due for display is zero or positive (as it's an amount *due*)
        const final_due_amount = Math.max(0, total_due);

        // Determine if payment was "No Payment" (true means no payment)
        const isDecemberDue = true; // Always assume current month due for this report
        const isNovemberDue = sheet2Ids.has(customer_id);
        const isOctoberDue = sheet3Ids.has(customer_id);

        const totalCount = (isDecemberDue ? 1 : 0) + (isNovemberDue ? 1 : 0) + (isOctoberDue ? 1 : 0);
        
        return {
          serial: index + 1,
          customer_id,
          PPPoE_Name,
          area,
          client_phone,
          December: isDecemberDue ? "No Payment" : "Payment",
          November: isNovemberDue ? "No Payment" : "Payment",
          October: isOctoberDue ? "No Payment" : "Payment",
          totalCount: totalCount,
          // Store the calculated, formatted due amount
          balance: `${parseInt(final_due_amount)} TK`, 
          raw_balance: final_due_amount, // Keep raw value for internal comparison if needed
          raw_selling_bdt: selling_bdt, // Keep raw value for context/debugging
        };
      }).filter(row => row.customer_id); // Filter out rows without a customer_id

      setResults(final);
      setFilteredResults(final);

      // Calculate summary statistics
      const summaryStats = {
        December: final.filter((r) => r.December === "No Payment").length,
        November: final.filter((r) => r.November === "No Payment").length,
        October: final.filter((r) => r.October === "No Payment").length,
      };
      setSummary(summaryStats);
      showSnackbar("Data loaded successfully!", "success");

    } catch (err) {
      showSnackbar("Failed to fetch data. Check network or sheet configuration.", "error");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };
  
  /**
   * Calls Gemini API to generate a customized collection message.
   */
  const generateCustomMessage = async (row) => {
    if (isGeneratingMessage || !row) return;
    
    setIsGeneratingMessage(true);
    setCustomMessage(""); // Clear previous message
    
    const overdueMonths = [
        row.December === "No Payment" && "December",
        row.November === "No Payment" && "November",
        row.October === "No Payment" && "October",
    ].filter(Boolean);
    
    const dueStatusText = overdueMonths.length > 0 ? 
        `Overdue Months: ${overdueMonths.join(", ")}` : 
        "No historical overdue months. The current due amount is for the present cycle.";


    const systemPrompt = `You are a highly professional and polite collections agent for a broadband Internet Service Provider. Your goal is to write a brief, friendly, and persuasive WhatsApp message (under 150 words) to a customer reminding them of their outstanding due amount and the need for prompt payment to avoid service interruption. The tone must be respectful but firm. Do not include any company name placeholders in your final message, only the content.`;

    const userQuery = `Customer Name: ${row.PPPoE_Name}. Due Amount: ${row.balance}. ${dueStatusText}. Generate the collection message.`;

    const payload = {
      contents: [{ parts: [{ text: userQuery }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
    };
    
    try {
      // Implement exponential backoff for API call
      let response;
      let result;
      let generatedText = null;
      let retries = 0;
      const MAX_RETRIES = 3;

      while (retries < MAX_RETRIES) {
        try {
          response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          result = await response.json();
          generatedText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
          
          if (generatedText) {
            break; // Success
          }
        } catch (error) {
          retries++;
          if (retries < MAX_RETRIES) {
            const delay = Math.pow(2, retries) * 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            throw error; // Throw after max retries
          }
        }
      }
      
      if (generatedText) {
        setCustomMessage(generatedText.trim());
        showSnackbar("Custom message generated successfully.", "success");
      } else {
        setCustomMessage("Error: Could not generate message.");
        showSnackbar("Error generating message from AI.", "error");
      }
    } catch (error) {
      console.error("Gemini API Error:", error);
      setCustomMessage("Error: Failed to connect to AI service.");
      showSnackbar("API connection failed.", "error");
    } finally {
      setIsGeneratingMessage(false);
    }
  };

  /**
   * Generates a list of WhatsApp links for customers with outstanding dues (totalCount > 0)
   * AND where the calculated balance (raw_balance) is greater than 0.
   */
  const handleGenerateBulkLinks = () => {
    // Filter results to only include customers who have a DUE amount > 0 AND a valid phone number
    const links = results.filter(row => row.raw_balance > 0 && row.client_phone).map((row) => {
      
      const sanitizedPhone = sanitizePhoneForWhatsApp(row.client_phone);
      if (!sanitizedPhone) return null; // Skip invalid phones

      const name = row.PPPoE_Name || 'Valued Client';
      const amount = row.balance || '0 TK'; 
      
      // Construct the message using the default message logic
      const whatsappMessage = getDefaultMessage(row);
      
      const encodedMessage = encodeURIComponent(whatsappMessage);
      const whatsappLink = `https://wa.me/${sanitizedPhone}?text=${encodedMessage}`;
      
      return {
        customer_id: row.customer_id,
        name: name,
        phone: row.client_phone,
        link: whatsappLink, 
        messageContent: whatsappMessage, 
        isDue: row.raw_balance > 0,
      };
    }).filter(item => item && item.phone); // Only include valid entries

    setBulkNotificationList(links);
    setIsBulkDialogOpen(true);
  };
  
  /**
   * Handles changes in filter dropdowns.
   * @param {string} field - The filter field (e.g., "October", "Area").
   * @param {string} value - The selected filter value.
   */
  const handleFilterChange = (field, value) => {
    const updatedFilter = { ...filter, [field]: value };
    setFilter(updatedFilter);
    applyFilters(updatedFilter, searchId);
  };

  /**
   * Applies all active filters and search text to the results.
   * @param {Object} updatedFilter - The current filter object.
   * @param {string} searchText - The current search text.
   */
  const applyFilters = (updatedFilter, searchText) => {
    const filtered = results.filter(
      (row) =>
        (!updatedFilter.December || row.December === updatedFilter.December) &&
        (!updatedFilter.November || row.November === updatedFilter.November) &&
        (!updatedFilter.October || row.October === updatedFilter.October) &&
        (!updatedFilter.Area || (row.area && row.area.toLowerCase() === updatedFilter.Area.toLowerCase())) &&
        (!updatedFilter.Balance || (row.balance && row.balance.toLowerCase() === updatedFilter.Balance.toLowerCase())) &&
        (!searchText ||
          (row.customer_id.toString().toLowerCase().includes(searchText.toLowerCase()) ||
            row.PPPoE_Name.toLowerCase().includes(searchText.toLowerCase()) ||
            row.client_phone.toLowerCase().includes(searchText.toLowerCase()))
        )
    );
    setFilteredResults(filtered);
    setPage(0); // Reset page to 0 when filters change
  };

  /**
   * Handles page changes for pagination.
   */
  const handleChangePage = (event, newPage) => setPage(newPage);

  /**
   * Handles changes in rows per page for pagination.
   */
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0); // Reset page to 0 when rows per page changes
  };

  /**
   * Clears custom message and selected row when dialog is closed.
   */
  const handleCloseDialog = () => {
    setSelectedRow(null);
    setCustomMessage("");
    setIsGeneratingMessage(false);
  };

  // Effect to load data when logged in status changes
  useEffect(() => {
    if (isLoggedIn) handleLoadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn]); // Dependency array includes isLoggedIn

  // Create Material-UI theme for dark/light mode
  const darkTheme = useMemo(() => createTheme({ palette: { mode: darkMode ? "dark" : "light" } }), [darkMode]);

  // Render login screen if not logged in
  if (!isLoggedIn) {
    return (
      <ThemeProvider theme={darkTheme}>
        <Box 
          sx={{ 
            backgroundColor: darkTheme.palette.background.default, 
            color: darkTheme.palette.text.primary, 
            minHeight: "100vh", 
            display: "flex", 
            flexDirection: "column", 
            alignItems: "center", 
            justifyContent: "center", 
            gap: 2 
          }}
        >
          <Paper elevation={3} sx={{ p: 4, borderRadius: 2, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 300 }}>
            <Typography variant="h5" align="center">Dashboard Login</Typography>
            <TextField 
              label="Username" 
              value={loginInfo.username} 
              onChange={(e) => setLoginInfo({ ...loginInfo, username: e.target.value })} 
              fullWidth
            />
            <TextField 
              label="Password" 
              type="password" 
              value={loginInfo.password} 
              onChange={(e) => setLoginInfo({ ...loginInfo, password: e.target.value })} 
              fullWidth
            />
            <Button variant="contained" onClick={handleLogin} fullWidth>Login</Button>
            <Typography variant="caption" align="center" color="textSecondary">
            </Typography>
          </Paper>
          <Snackbar
            open={snackbar.open}
            autoHideDuration={6000}
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          >
            <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
              {snackbar.message}
            </Alert>
          </Snackbar>
        </Box>
      </ThemeProvider>
    );
  }

  // Helper component to display the WhatsApp link section in the dialog
  const WhatsAppLinkSection = ({ selectedRow, messageContent }) => {
    const sanitizedPhone = sanitizePhoneForWhatsApp(selectedRow.client_phone);
    const isValid = !!sanitizedPhone;
    
    if (!isValid) {
        return (
            <Box component="span" sx={{ color: 'error.main', fontStyle: 'italic', display: 'inline' }}>
                Invalid phone number: {selectedRow.client_phone}
            </Box>
        );
    }

    const encodedMessage = encodeURIComponent(messageContent);
    const whatsappLink = `https://wa.me/${sanitizedPhone}?text=${encodedMessage}`;

    return (
        <Button 
            variant="contained" 
            color="success" // Use success color for the WhatsApp button
            size="small"
            // *** FIX: Use onClick with window.open for reliable tab opening ***
            onClick={() => window.open(whatsappLink, '_blank')}
            sx={{ mt: 1, textTransform: 'none', fontWeight: 'bold' }}
        >
            Send Notification via WhatsApp
        </Button>
    );
  };

  // Main application render
  return (
    <ThemeProvider theme={darkTheme}>
      <Box sx={{ backgroundColor: darkTheme.palette.background.default, color: darkTheme.palette.text.primary, minHeight: "100vh" }}>
        <AppBar position="static">
          <Toolbar sx={{ justifyContent: "space-between" }}>
            <FormControlLabel 
              control={<Switch checked={darkMode} onChange={() => setDarkMode(!darkMode)} />} 
              label="Dark Mode" 
              sx={{ color: darkTheme.palette.primary.contrastText }} 
            />
            <Typography variant="h6" sx={{ flexGrow: 1, textAlign: "center", fontSize: { xs: '0.9rem', sm: '1.25rem' } }}>
                Customer Last 3 Month Payment History
            </Typography>
            <Button color="inherit" onClick={handleLogout}>Logout</Button>
          </Toolbar>
        </AppBar>

        <Box sx={{ px: { xs: 1, sm: 2, md: 3 }, py: 2, minHeight: "calc(100vh - 64px)" }}>
          
          {/* Summary and Bulk WhatsApp Link Button (Combined and Aligned) */}
          <Box mb={4} display="flex" justifyContent="center" gap={{ xs: 2, sm: 4 }} flexWrap="wrap" alignItems="center">
            <Typography variant="subtitle1" component="span" sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}>
              December No Payment: <Box component="span" fontWeight="bold" color="error.main">{summary.December}</Box>
            </Typography>
            <Typography variant="subtitle1" component="span" sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}>
              November No Payment: <Box component="span" fontWeight="bold" color="error.main">{summary.November}</Box>
            </Typography>
            <Typography variant="subtitle1" component="span" sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }}>
              October No Payment: <Box component="span" fontWeight="bold" color="error.main">{summary.October}</Box>
            </Typography>
          </Box>
          
          {/* Total Records (Boxed) and Bulk Link Button / Loading Indicator */}
          <Box mb={2} display="flex" justifyContent={{ xs: 'center', md: 'space-between' }} alignItems="center" flexWrap="wrap" gap={2}>
            
            {/* Total Records Box */}
            <Paper elevation={3} sx={{ 
                p: 1.5, 
                display: 'flex', 
                alignItems: 'center', 
                gap: 1, 
                minWidth: { xs: 'auto', sm: 200 } 
            }}>
                <Typography variant="h6" color="primary" sx={{ 
                    fontSize: { xs: '1rem', sm: '1.25rem' }, 
                    whiteSpace: 'nowrap' 
                }}>
                  Total Records: <Box component="span" fontWeight="bold">{filteredResults.length}</Box>
                </Typography>
                {isLoading && <CircularProgress size={24} />}
            </Paper>

            {/* Bulk Link Button */}
            <Button 
              variant="contained" 
              color="secondary" 
              onClick={handleGenerateBulkLinks} 
              disabled={isLoading || filteredResults.length === 0}
              sx={{ 
                ml: { xs: 0, sm: 2 }, 
                mt: { xs: 1, md: 0 },
                whiteSpace: 'nowrap'
              }}
            >
          WhatsApp Bulk Open
            </Button>
          </Box>

          {/* Filters and Search Bar */}
          <Box display="flex" gap={2} justifyContent="center" flexWrap="wrap" mb={2} sx={{ 
            '& .MuiFormControl-root, & .MuiTextField-root': { minWidth: { xs: '45%', sm: 140 } } 
          }}>
            {["December", "November", "October", "Area", "Balance"].map((field) => (
              <FormControl key={field} sx={{ minWidth: 120 }} size="small">
                <InputLabel>{field}</InputLabel>
                <Select
                  value={filter[field] || ""}
                  label={field}
                  onChange={(e) => handleFilterChange(field, e.target.value)}
                >
                  <MenuItem value="">All</MenuItem>
                  {(() => {
                    let uniqueValues = new Set();
                    if (field === "December" || field === "November" || field === "October") {
                      uniqueValues.add("No Payment");
                      uniqueValues.add("Payment");
                    }

                    results.forEach(r => {
                      let valueToExtract;
                      if (field === "December" || field === "November" || field === "October") {
                        valueToExtract = r[field];
                      } else {
                        // Use .toLowerCase() to match the filtering logic for Area/Balance
                        valueToExtract = r[field.toLowerCase()]; 
                      }
                      if (valueToExtract) {
                        uniqueValues.add(valueToExtract);
                      }
                    });

                    return [...uniqueValues].sort().map((value) => (
                      <MenuItem key={value} value={value}>{value}</MenuItem>
                    ));
                  })()}
                </Select>
              </FormControl>
            ))}
            <TextField
              label="Search ID/Name/Mobile"
              variant="outlined"
              size="small"
              sx={{ minWidth: 150, maxWidth: 250 }}
              value={searchId}
              onChange={(e) => {
                const val = e.target.value;
                setSearchId(val);
                applyFilters(filter, val);
              }}
            />
          </Box>

          {/* Data Table */}
          <TableContainer component={Paper} sx={{ maxHeight: '70vh' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <StyledTableCell>SL_No</StyledTableCell>
                  <StyledTableCell>Client_ID</StyledTableCell>
                  <StyledTableCell>PPPoE_Name</StyledTableCell>
                  <StyledTableCell>Area_Name</StyledTableCell>
                  <StyledTableCell>Mobile_No</StyledTableCell>
                  <StyledTableCell>December</StyledTableCell>
                  <StyledTableCell>November</StyledTableCell>
                  <StyledTableCell>October</StyledTableCell>
                  <StyledTableCell>Count</StyledTableCell>
                  <StyledTableCell>Total_Due</StyledTableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredResults
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((row, idx) => (
                    // The Fade component provides a nice staggered effect upon initial load/filter change.
                    <Fade in timeout={100 + idx * 10} key={row.customer_id || idx}>
                      <AnimatedRow onClick={() => setSelectedRow(row)}>
                        <TableCell>{row.serial}</TableCell>
                        <TableCell>{row.customer_id}</TableCell>
                        <TableCell>{row.PPPoE_Name}</TableCell>
                        <TableCell>{row.area}</TableCell>
                        <TableCell>{row.client_phone}</TableCell>
                        {/* Conditional color for payment status */}
                        <TableCell sx={{ color: row.December === "No Payment" ? "error.main" : "success.main" }}>{row.December}</TableCell>
                        <TableCell sx={{ color: row.November === "No Payment" ? "error.main" : "success.main" }}>{row.November}</TableCell>
                        <TableCell sx={{ color: row.October === "No Payment" ? "error.main" : "success.main" }}>{row.October}</TableCell>
                        <TableCell>{row.totalCount}</TableCell>
                        {/* Display the newly calculated Total Due */}
                        <TableCell>{row.balance}</TableCell>
                      </AnimatedRow>
                    </Fade>
                  ))}
                {/* Fallback when no results are found */}
                {filteredResults.length === 0 && !isLoading && (
                    <TableRow>
                        <TableCell colSpan={10} align="center">
                            <Typography variant="body1" sx={{ py: 3 }}>
                                No results found matching the current filters/search.
                            </Typography>
                        </TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          
          {/* Table Pagination */}
          <Box mt={2} display="flex" justifyContent="center">
            <TablePagination
              component="div"
              count={filteredResults.length}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              rowsPerPageOptions={[10, 25, 50, 100]}
              onRowsPerPageChange={handleChangeRowsPerPage}
              labelDisplayedRows={({ from, to, count }) => `${from}-${to} of ${count}`}
            />
          </Box>
          
          {/* Individual Row Dialog (Details and WhatsApp Link) */}
          <Dialog open={!!selectedRow} onClose={handleCloseDialog}>
            <DialogTitle>Client Details</DialogTitle>
            <DialogContent sx={{ maxWidth: { xs: "90vw", sm: "400px" } }}>
              {selectedRow && (
                <DialogContentText component="div">
                  <p><strong>Customer ID:</strong> {selectedRow.customer_id}</p>
                  <p><strong>PPPoE Name:</strong> {selectedRow.PPPoE_Name}</p>
                  <p><strong>Area:</strong> {selectedRow.area}</p>
                  
                  {/* --- Mobile No link FIX (Prevents Canvas interception) --- */}
                  <p>
                    <strong>Mobile No:</strong>{" "}
                    <Typography
                      component="span"
                      onClick={(e) => {
                        // Manually open the tel: protocol in a new window/tab
                        window.open(`tel:${selectedRow.client_phone}`, '_blank');
                      }}
                      sx={{
                        color: 'primary.main',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        fontWeight: 'bold', 
                        '&:hover': { opacity: 0.8 }
                      }}
                    >
                      {selectedRow.client_phone}
                    </Typography>
                  </p>
                  <p><strong>December:</strong> <Box component="span" color={selectedRow.December === "No Payment" ? "error.main" : "success.main"}>{selectedRow.December}</Box></p>
                  <p><strong>November:</strong> <Box component="span" color={selectedRow.November === "No Payment" ? "error.main" : "success.main"}>{selectedRow.November}</Box></p>
                  <p><strong>October:</strong> <Box component="span" color={selectedRow.October === "No Payment" ? "error.main" : "success.main"}>{selectedRow.October}</Box></p>
                  <p><strong>Count:</strong> <Box component="span" fontWeight="bold">{selectedRow.totalCount}</Box></p>
                  {/* Display the calculated Total Due */}
                  <p><strong>Total Due:</strong> <Box component="span" fontWeight="bold" color="warning.main">{selectedRow.balance}</Box></p>
                  
                  <Box mt={2}>
                    {/* *** FIX APPLIED HERE: Using WhatsAppLinkSection for reliable button click *** */}
                    <WhatsAppLinkSection 
                        selectedRow={selectedRow} 
                        messageContent={customMessage || getDefaultMessage(selectedRow)}
                    />
                  </Box>
                </DialogContentText>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDialog}>CLOSE</Button>
            </DialogActions>
          </Dialog>
          
          {/* Bulk Notification Dialog (WhatsApp Links List) */}
          <Dialog 
            open={isBulkDialogOpen} 
            onClose={() => setIsBulkDialogOpen(false)} 
            maxWidth="md" 
            fullWidth
          >
            <DialogTitle>Bulk WhatsApp Links ({bulkNotificationList.length} Customers Due)</DialogTitle>
            <DialogContent>
              <Typography variant="body2" color="success.main" gutterBottom>
                This list contains direct **WhatsApp links** for all **{bulkNotificationList.length}** customers with an outstanding due amount (&gt; 0) and a valid phone number.
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Clicking **"Open WhatsApp"** will open a new tab/app with the customer's number and a pre-filled reminder message.
              </Typography>
              <Paper elevation={1} style={{ maxHeight: '60vh', overflowY: 'auto', padding: '10px' }}>
                {bulkNotificationList.map((item, index) => (
                  <Box 
                    key={item.customer_id} 
                    sx={{ 
                      py: 1, 
                      borderBottom: index < bulkNotificationList.length - 1 ? '1px solid rgba(0, 0, 0, 0.1)' : 'none', 
                      display: 'flex', 
                      flexDirection: { xs: 'column', sm: 'row' },
                      alignItems: { xs: 'flex-start', sm: 'center' },
                      justifyContent: 'space-between',
                      bgcolor: darkTheme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'white',
                      gap: 1
                    }}
                  >
                    <Typography variant="body2" sx={{ flexGrow: 1, pr: 2, order: { xs: 1, sm: 1 } }}>
                      <Box component="span" fontWeight="bold">{item.name}</Box> ({item.phone})
                    </Typography>
                    {/* *** FIX APPLIED HERE: Use onClick with window.open for reliable tab opening *** */}
                    <Button 
                      onClick={() => window.open(item.link, '_blank')}
                      size="small" 
                      variant="contained"
                      color="success"
                      sx={{ flexShrink: 0, order: { xs: 3, sm: 2 } }}
                    >
                      Send WhatsApp
                    </Button>
                    <Typography 
                        variant="caption" 
                        color="textSecondary" 
                        sx={{ 
                            mt: 0.5, 
                            fontStyle: 'italic', 
                            maxWidth: '100%', 
                            overflowWrap: 'break-word',
                            order: { xs: 2, sm: 3 }
                        }}
                    >
                      Message Content Preview: {item.messageContent}
                    </Typography>
                  </Box>
                ))}
                {bulkNotificationList.length === 0 && (
                    <Typography variant="body1" align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        No customers found with outstanding dues and a valid mobile number to notify.
                    </Typography>
                )}
              </Paper>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setIsBulkDialogOpen(false)}>Close</Button>
            </DialogActions>
          </Dialog>
        </Box>
        
        {/* Global Snackbar for Alerts */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </ThemeProvider>
  );
}

export default App;
