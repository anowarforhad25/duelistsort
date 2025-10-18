import { useEffect, useState } from "react";
import {
  Box, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, Typography, Fade, Button, MenuItem, FormControl,
  Select, InputLabel, Dialog, DialogTitle, DialogContent, DialogContentText,
  DialogActions, Link, Switch, FormControlLabel, TablePagination, AppBar,
  Toolbar, TextField
} from "@mui/material";
import { styled, createTheme, ThemeProvider } from "@mui/material/styles";

// Hardcoded user data for login (for demonstration purposes)
const USERS = [
  { username: "01815128906", password: "Abc1234#" },
  { username: "01816645450", password: "FB1234d@ta" },
  { username: "01811309143", password: "Abc9876#" },
  { username: "01814371275", password: "Abc4321#" },
];

// Styled TableCell for header
const StyledTableCell = styled(TableCell)(({ theme }) => ({
  fontWeight: 600,
  color: theme.palette.primary.contrastText,
  backgroundColor: theme.palette.primary.main,
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


function App() {
  const [results, setResults] = useState([]);
  const [filteredResults, setFilteredResults] = useState([]);
  const [filter, setFilter] = useState({ October: "", September: "", August: "", Area: "", Balance: "" });
  const [summary, setSummary] = useState({ October: 0, September: 0, August: 0 });
  const [selectedRow, setSelectedRow] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(100);
  // Check session storage for login status
  const [isLoggedIn, setIsLoggedIn] = useState(() => sessionStorage.getItem("isLoggedIn") === "true");
  const [loginInfo, setLoginInfo] = useState({ username: "", password: "" });
  const [searchId, setSearchId] = useState("");
  
  // New state for bulk notification feature
  const [bulkNotificationList, setBulkNotificationList] = useState([]);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);

  // Google Sheet ID
  const sheetId = "1LYAKchZIX6qhGqBh4AxrkJU_4bGNMEJgegHHq-kYZwA";

  /**
   * Handles user login. Note: alert() is used here per the user's provided code, 
   * but for a real-world app, a custom modal or Snackbar should be used.
   */
  const handleLogin = () => {
    const match = USERS.find(
      (user) => user.username === loginInfo.username && user.password === loginInfo.password
    );
    if (match) {
      setIsLoggedIn(true);
      sessionStorage.setItem("isLoggedIn", "true");
    } else {
      // NOTE: Using alert() as provided by the user, though generally discouraged in production
      alert("Invalid credentials");
    }
  };

  /**
   * Handles user logout.
   */
  const handleLogout = () => {
    sessionStorage.removeItem("isLoggedIn");
    setIsLoggedIn(false);
    setLoginInfo({ username: "", password: "" });
  };

  /**
   * Loads data from Google Sheets.
   */
  const handleLoadData = async () => {
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

        // The 'balance' column holds the authoritative ledger balance (due amount).
        const amount_owed = parseFloat(row.balance || 0);
        
        // Total Due is the positive amount owed.
        const total_due = Math.max(0, amount_owed); 

        return {
          serial: index + 1,
          customer_id,
          PPPoE_Name,
          area,
          client_phone,
          October: "No Payment", // Assumed current month logic
          September: sheet2Ids.has(customer_id) ? "No Payment" : "Payment",
          August: sheet3Ids.has(customer_id) ? "No Payment" : "Payment",
          totalCount:
            1 + // For October (always 'No Payment')
            (sheet2Ids.has(customer_id) ? 1 : 0) +
            (sheet3Ids.has(customer_id) ? 1 : 0),
          balance: `${parseInt(total_due)} TK`, // Holds the correct Total Due amount
        };
      });

      setResults(final);
      setFilteredResults(final);

      // Calculate summary statistics
      const summaryStats = {
        October: final.length,
        September: final.filter((r) => r.September === "No Payment").length,
        August: final.filter((r) => r.August === "No Payment").length,
      };
      setSummary(summaryStats);
    } catch (err) {
      // NOTE: Using alert() as provided by the user, though generally discouraged in production
      alert("Failed to fetch data");
      console.error(err);
    }
  };

  /**
   * Generates a list of WhatsApp links for customers with outstanding dues (totalCount > 0).
   */
  const handleGenerateBulkLinks = () => {
    // Filter results to only include customers who have at least one 'No Payment' (Count > 0)
    const links = results.filter(row => row.totalCount > 0 && row.client_phone).map((row, index) => {
      
      const sanitizedPhone = sanitizePhoneForWhatsApp(row.client_phone);
      if (!sanitizedPhone) return null; // Skip invalid phones

      const name = row.PPPoE_Name || 'Valued Client';
      const amount = row.balance || '0 TK'; 
      
      // Simplified the message by replacing newlines with periods for better URL compatibility.
      const whatsappMessage = `Dear ${name}. This is a reminder that your total outstanding due amount is ${amount}. Kindly complete the payment as soon as possible to ensure uninterrupted service. Thank you for your cooperation. [Your Company Name/Ref.]`;
      
      // URL encode the message
      const encodedMessage = encodeURIComponent(whatsappMessage);
      // Construct the WhatsApp link using the sanitized phone number
      const whatsappLink = `https://wa.me/${sanitizedPhone}?text=${encodedMessage}`;
      
      // --- DIAGNOSTIC LOGGING ---
      if (index < 5) { // Only log the first 5 for clean console output
          console.log(`[BULK] Link for ID ${row.customer_id}: ${whatsappLink}`);
      }
      // --------------------------

      return {
        customer_id: row.customer_id,
        name: name,
        phone: row.client_phone,
        link: whatsappLink, // Store the generated link
        messageContent: whatsappMessage, // Store content for display
        isDue: row.totalCount > 0,
      };
    }).filter(item => item && item.phone); // Only include those with a phone number and valid link

    setBulkNotificationList(links);
    setIsBulkDialogOpen(true);
  };
  
  /**
   * Handles changes in filter dropdowns.
   * @param {string} field - The filter field (e.g., "August", "Area").
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
        (!updatedFilter.October || row.October === updatedFilter.October) &&
        (!updatedFilter.September || row.September === updatedFilter.September) &&
        (!updatedFilter.August || row.August === updatedFilter.August) &&
        (!updatedFilter.Area || (row.area && row.area.toLowerCase() === updatedFilter.Area.toLowerCase())) &&
        (!updatedFilter.Balance || (row.balance && row.balance.toLowerCase() === updatedFilter.Balance.toLowerCase())) &&
        (!searchText ||
          (row.customer_id.toString().toLowerCase().includes(searchText.toLowerCase()) ||
            row.PPPoE_Name.toLowerCase().includes(searchText.toLowerCase())) ||
            row.client_phone.toLowerCase().includes(searchText.toLowerCase())
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

  // Effect to load data when logged in status changes
  useEffect(() => {
    if (isLoggedIn) handleLoadData();
  }, [isLoggedIn]);

  // Create Material-UI theme for dark/light mode
  const darkTheme = createTheme({ palette: { mode: darkMode ? "dark" : "light" } });

  // Render login screen if not logged in
  if (!isLoggedIn) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" minHeight="100vh" gap={2}>
        <Typography variant="h5">Login to Access</Typography>
        <TextField label="Username" value={loginInfo.username} onChange={(e) => setLoginInfo({ ...loginInfo, username: e.target.value })} />
        <TextField label="Password" type="password" value={loginInfo.password} onChange={(e) => setLoginInfo({ ...loginInfo, password: e.target.value })} />
        <Button variant="contained" onClick={handleLogin}>Login</Button>
      </Box>
    );
  }

  // Helper component to display the WhatsApp link section in the dialog
  const WhatsAppLinkSection = ({ selectedRow }) => {
    const name = selectedRow.PPPoE_Name || 'Valued Client';
    const amount = selectedRow.balance || '0 TK';
    const sanitizedPhone = sanitizePhoneForWhatsApp(selectedRow.client_phone);
    const isValid = !!sanitizedPhone;

    // DEBUGGING DISPLAY & VALIDATION
    const DebugLine = (
        <Typography variant="caption" display="block" color={isValid ? "success.main" : "error.main"}>
            Sanitized Number: <strong>{sanitizedPhone || 'Invalid'}</strong>
        </Typography>
    );

    if (!isValid) {
        return (
            <>
                <Typography color="error" variant="caption" display="block">
                    Invalid phone number. Must be a 10-digit mobile number in the sheet.
                </Typography>
                {DebugLine}
            </>
        );
    }

    // Simplified the message by replacing newlines with periods for better URL compatibility.
    const whatsappMessage = `Dear ${name}. This is a reminder that your total outstanding due amount is ${amount}. Kindly complete the payment as soon as possible to ensure uninterrupted service. Thank you for your cooperation. [Your Company Name/Ref.]`;
    
    const encodedMessage = encodeURIComponent(whatsappMessage);
    const whatsappLink = `https://wa.me/${sanitizedPhone}?text=${encodedMessage}`;

    // --- DIAGNOSTIC LOGGING ---
    console.log(`[INDIVIDUAL] Link for ID ${selectedRow.customer_id}: ${whatsappLink}`);
    // --------------------------

    return (
        <>
            {/* Component is explicitly set to "a" for reliable external navigation */}
            <Button
                component="a" 
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                variant="outlined"
                size="small"
                color="success"
            >
                Send WhatsApp
            </Button>
            {DebugLine}
            <Typography variant="caption" display="block" color="textSecondary">
                *Opens in a new window/app with a pre-filled message.
            </Typography>
        </>
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
            <Typography variant="h6" sx={{ flexGrow: 1, textAlign: "center" }}>Customer Based Last 3 Month No Payment History</Typography>
            <Button color="inherit" onClick={handleLogout}>Logout</Button>
          </Toolbar>
        </AppBar>

        <Box sx={{ px: { xs: 1, sm: 2, md: 3 }, py: 2, minHeight: "calc(100vh - 64px)" }}>
          {/* Summary and Bulk WhatsApp Link Button */}
          <Box mb={4} display="flex" justifyContent="center" gap={4} flexWrap="wrap" alignItems="center">
            <Typography variant="subtitle1">October No Payment: {summary.October}</Typography>
            <Typography variant="subtitle1">September No Payment: {summary.September}</Typography>
            <Typography variant="subtitle1">August No Payment: {summary.August}</Typography>
			  {/* BUTTON TEXT REVERTED TO WHATSAPP LINKS */}
            <Button variant="contained" color="secondary" onClick={handleGenerateBulkLinks} sx={{ ml: { xs: 0, sm: 2 }, mt: { xs: 2, sm: 0 } }}>
              Generate Bulk WhatsApp Links
            </Button>
          </Box>

          <Box mb={2} display="flex" justifyContent="center">
            <Typography variant="h6" color="primary">
              Total Records Data: {filteredResults.length}
            </Typography>
          </Box>

          <Box display="flex" gap={2} justifyContent="center" flexWrap="wrap" mb={2}>
            {["October", "September", "August", "Area", "Balance"].map((field) => (
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
                    if (field === "October" || field === "September" || field === "August") {
                      uniqueValues.add("No Payment");
                      uniqueValues.add("Payment");
                    }

                    results.forEach(r => {
                      let valueToExtract;
                      if (field === "October" || field === "September" || field === "August") {
                        valueToExtract = r[field];
                      } else {
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
              label="Search_ID/PPPoE/Mobile"
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

          <TableContainer component={Paper}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <StyledTableCell>SL_No</StyledTableCell>
                  <StyledTableCell>Client_ID</StyledTableCell>
                  <StyledTableCell>PPPoE_Name</StyledTableCell>
                  <StyledTableCell>Area_Name</StyledTableCell>
                  <StyledTableCell>Mobile_No</StyledTableCell>
                  <StyledTableCell>October</StyledTableCell>
                  <StyledTableCell>September</StyledTableCell>
                  <StyledTableCell>August</StyledTableCell>
                  <StyledTableCell>Count</StyledTableCell>
                  <StyledTableCell>Total_Due</StyledTableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredResults
                  .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                  .map((row, idx) => (
                    <Fade in timeout={300 + idx * 20} key={row.customer_id}>
                      <AnimatedRow onClick={() => setSelectedRow(row)}>
                        <TableCell>{row.serial}</TableCell>
                        <TableCell>{row.customer_id}</TableCell>
                        <TableCell>{row.PPPoE_Name}</TableCell>
                        <TableCell>{row.area}</TableCell>
                        <TableCell>{row.client_phone}</TableCell>
                        <TableCell sx={{ color: row.October === "No Payment" ? "error.main" : "success.main" }}>{row.October}</TableCell>
                        <TableCell sx={{ color: row.September === "No Payment" ? "error.main" : "success.main" }}>{row.September}</TableCell>
                        <TableCell sx={{ color: row.August === "No Payment" ? "error.main" : "success.main" }}>{row.August}</TableCell>
                        <TableCell>{row.totalCount}</TableCell>
                        <TableCell>{row.balance}</TableCell>
                      </AnimatedRow>
                    </Fade>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
          
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
            {/* Individual Row Dialog */}
            <Dialog open={!!selectedRow} onClose={() => setSelectedRow(null)}>
              <DialogTitle>Client Details</DialogTitle>
              <DialogContent sx={{ maxWidth: { xs: "90vw", sm: "400px" } }}>
                {selectedRow && (
                  <DialogContentText component="div">
                    <p><strong>Customer ID:</strong> {selectedRow.customer_id}</p>
                    <p><strong>PPPoE Name:</strong> {selectedRow.PPPoE_Name}</p>
                    <p><strong>Area:</strong> {selectedRow.area}</p>
                    <p>
                      <strong>Mobile No (Raw):</strong>{" "}
                      <Link href={`tel:${selectedRow.client_phone}`} underline="hover" color="primary">
                        {selectedRow.client_phone}
                      </Link>
                    </p>
					          <p>
                      <strong>WhatsApp Notification:</strong>{" "}
                      <WhatsAppLinkSection selectedRow={selectedRow} />
                    </p>
                    <p><strong>October:</strong> {selectedRow.October}</p>
                    <p><strong>September:</strong> {selectedRow.September}</p>
                    <p><strong>August:</strong> {selectedRow.August}</p>
                    <p><strong>Count:</strong> {selectedRow.totalCount}</p>
                    <p><strong>Total Due:</strong> {selectedRow.balance}</p>
                  </DialogContentText>
                )}
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setSelectedRow(null)}>Close</Button>
              </DialogActions>
            </Dialog>
            
            {/* Bulk Notification Dialog (Now for WhatsApp Links) */}
            <Dialog 
                open={isBulkDialogOpen} 
                onClose={() => setIsBulkDialogOpen(false)} 
                maxWidth="md" 
                fullWidth
            >
              <DialogTitle>Bulk WhatsApp Links ({bulkNotificationList.length} Customers)</DialogTitle>
              <DialogContent>
                <Typography variant="body2" color="success.main" gutterBottom>
                    This list contains direct **WhatsApp links** for all {bulkNotificationList.length} customers with outstanding dues.
                </Typography>
                <Typography variant="body2" color="textSecondary" gutterBottom>
                    Clicking **"Open WhatsApp"** for each entry will open a new tab/app with the customer's number and a pre-filled reminder message.
                </Typography>
                <Paper elevation={1} style={{ maxHeight: '60vh', overflowY: 'auto', padding: '10px' }}>
                  {bulkNotificationList.map((item, index) => (
                    <Box 
                        key={item.customer_id} 
                        sx={{ 
                            py: 1, 
                            borderBottom: index < bulkNotificationList.length - 1 ? '1px solid rgba(0, 0, 0, 0.1)' : 'none', 
                            display: 'flex', 
                            flexDirection: 'column',
                            alignItems: 'flex-start',
                            bgcolor: darkTheme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'white'
                        }}
                    >
                      <Box display="flex" justifyContent="space-between" width="100%">
                        <Typography variant="body2" sx={{ flexGrow: 1, pr: 2 }}>
                          <Box component="span" fontWeight="bold">{item.name}</Box> ({item.phone})
                        </Typography>
                        {/* Ensure bulk link also uses a plain anchor tag */}
                        <Button 
                          component="a"
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          size="small" 
                          variant="contained"
                          color="success"
                          sx={{ flexShrink: 0 }}
                        >
                          Open WhatsApp
                        </Button>
                      </Box>
                      <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, fontStyle: 'italic', maxWidth: '100%', overflowWrap: 'break-word' }}>
                          Message Content Preview: {item.messageContent}
                      </Typography>
                    </Box>
                  ))}
                  {bulkNotificationList.length === 0 && (
                      <Typography variant="body1" align="center" sx={{ py: 4, color: 'text.secondary' }}>
                          No customers found with outstanding dues (Count &gt; 0) and a valid mobile number to notify.
                      </Typography>
                  )}
                </Paper>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setIsBulkDialogOpen(false)}>Close</Button>
              </DialogActions>
            </Dialog>
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
