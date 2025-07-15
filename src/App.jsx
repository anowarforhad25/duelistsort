import { useEffect, useState } from "react";
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Fade,
  Button,
  MenuItem,
  FormControl,
  Select,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Link,
  Switch,
  FormControlLabel,
  TablePagination,
  TextField
} from "@mui/material";
import { styled, createTheme, ThemeProvider } from "@mui/material/styles";

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  fontWeight: 600,
  color: theme.palette.primary.contrastText,
  backgroundColor: theme.palette.primary.main,
}));

const AnimatedRow = styled(TableRow)(({ theme }) => ({
  transition: "all 0.3s ease",
  cursor: "pointer",
  "&:hover": {
    backgroundColor: theme.palette.action.hover,
    transform: "scale(1.01)",
    boxShadow: theme.shadows[1],
  },
}));

const fetchSheet = async (sheetId, sheetName) => {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${sheetName}`;
  const res = await fetch(url);
  const text = await res.text();
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

const USERS = [
  { username: "01815128906", password: "Abc1234#" },
  // Add more users here
];

function App() {
  const [results, setResults] = useState([]);
  const [filteredResults, setFilteredResults] = useState([]);
  const [filter, setFilter] = useState({ July: "", June: "", May: "" });
  const [summary, setSummary] = useState({ July: 0, June: 0, May: 0 });
  const [selectedRow, setSelectedRow] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(100);
  const [authenticated, setAuthenticated] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });

  const sheetId = "1LYAKchZIX6qhGqBh4AxrkJU_4bGNMEJgegHHq-kYZwA";

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
        const client_phone = row.client_phone || "";
        let balance = parseFloat(row.balance || 0);

        if (balance < 0) {
          balance = Math.abs(balance) + 500;
        } else {
          balance = 500 - balance;
        }

        return {
          serial: index + 1,
          customer_id,
          PPPoE_Name,
          client_phone,
          July: "No Payment",
          June: sheet2Ids.has(customer_id) ? "No Payment" : "Payment",
          May: sheet3Ids.has(customer_id) ? "No Payment" : "Payment",
          totalCount:
            1 +
            (sheet2Ids.has(customer_id) ? 1 : 0) +
            (sheet3Ids.has(customer_id) ? 1 : 0),
          balance: `${parseInt(balance)} TK`,
        };
      });

      setResults(final);
      setFilteredResults(final);

      const summaryStats = {
        July: final.length,
        June: final.filter((r) => r.June === "No Payment").length,
        May: final.filter((r) => r.May === "No Payment").length,
      };
      setSummary(summaryStats);
    } catch (err) {
      alert("Failed to fetch data");
      console.error(err);
    }
  };

  const handleFilterChange = (month, value) => {
    const updatedFilter = { ...filter, [month]: value };
    setFilter(updatedFilter);
    const filtered = results.filter(
      (row) =>
        (!updatedFilter.July || row.July === updatedFilter.July) &&
        (!updatedFilter.June || row.June === updatedFilter.June) &&
        (!updatedFilter.May || row.May === updatedFilter.May)
    );
    setFilteredResults(filtered);
    setPage(0);
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleLogin = () => {
    const found = USERS.find(
      (u) => u.username === loginForm.username && u.password === loginForm.password
    );
    if (found) {
      setAuthenticated(true);
      handleLoadData();
    } else {
      alert("Invalid username or password");
    }
  };

  const darkTheme = createTheme({ palette: { mode: darkMode ? "dark" : "light" } });

  if (!authenticated) {
    return (
      <ThemeProvider theme={darkTheme}>
        <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="100vh">
          <Typography variant="h5" gutterBottom>Login</Typography>
          <TextField
            label="Username"
            variant="outlined"
            value={loginForm.username}
            onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
            sx={{ mb: 2, width: 300 }}
          />
          <TextField
            label="Password"
            variant="outlined"
            type="password"
            value={loginForm.password}
            onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
            sx={{ mb: 2, width: 300 }}
          />
          <Button variant="contained" onClick={handleLogin}>Login</Button>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={darkTheme}>
      <Box sx={{ px: { xs: 1, sm: 2, md: 3 }, py: 2, minHeight: "100vh" }}>
        <Box display="flex" justifyContent="center" alignItems="center" mb={2} gap={2}>
          <Typography variant="h4" fontWeight={700} textAlign="center">No Payment Summary</Typography>
          <FormControlLabel
            control={<Switch checked={darkMode} onChange={() => setDarkMode(!darkMode)} />}
            label="Dark Mode"
          />
        </Box>

        <Box mb={2} display="flex" justifyContent="center" gap={4}>
          <Typography variant="subtitle1">July No Payment: {summary.July}</Typography>
          <Typography variant="subtitle1">June No Payment: {summary.June}</Typography>
          <Typography variant="subtitle1">May No Payment: {summary.May}</Typography>
        </Box>

        <Box display="flex" gap={2} justifyContent="center" flexWrap="wrap" mb={2}>
          {"July,June,May".split(",").map((month) => (
            <FormControl key={month} sx={{ minWidth: 120 }} size="small">
              <InputLabel>{month}</InputLabel>
              <Select
                value={filter[month]}
                label={month}
                onChange={(e) => handleFilterChange(month, e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="No Payment">No Payment</MenuItem>
                <MenuItem value="Payment">Payment</MenuItem>
              </Select>
            </FormControl>
          ))}
        </Box>

        <TableContainer component={Paper} sx={{ maxWidth: "100%", overflowX: "auto", mx: "auto" }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <StyledTableCell>Serial</StyledTableCell>
                <StyledTableCell>Client_ID</StyledTableCell>
                <StyledTableCell>PPPoE_Name</StyledTableCell>
                <StyledTableCell>Mobile_No</StyledTableCell>
                <StyledTableCell>July</StyledTableCell>
                <StyledTableCell>June</StyledTableCell>
                <StyledTableCell>May</StyledTableCell>
                <StyledTableCell>Count</StyledTableCell>
                <StyledTableCell>Total_Due</StyledTableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredResults.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row, idx) => (
                <Fade in timeout={300 + idx * 50} key={idx}>
                  <AnimatedRow onClick={() => setSelectedRow(row)}>
                    <TableCell>{row.serial}</TableCell>
                    <TableCell>{row.customer_id}</TableCell>
                    <TableCell>{row.PPPoE_Name}</TableCell>
                    <TableCell>{row.client_phone}</TableCell>
                    <TableCell sx={{ color: row.July === "No Payment" ? "error.main" : "success.main" }}>{row.July}</TableCell>
                    <TableCell sx={{ color: row.June === "No Payment" ? "error.main" : "success.main" }}>{row.June}</TableCell>
                    <TableCell sx={{ color: row.May === "No Payment" ? "error.main" : "success.main" }}>{row.May}</TableCell>
                    <TableCell>{row.totalCount}</TableCell>
                    <TableCell>{row.balance}</TableCell>
                  </AnimatedRow>
                </Fade>
              ))}
            </TableBody>
          </Table>
          <Box display="flex" justifyContent="center">
            <TablePagination
              component="div"
              count={filteredResults.length}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              rowsPerPageOptions={[100]}
              labelDisplayedRows={({ page }) => `Page ${page + 1}`}
            />
          </Box>
        </TableContainer>

        <Dialog open={!!selectedRow} onClose={() => setSelectedRow(null)}>
          <DialogTitle>Client Details</DialogTitle>
          <DialogContent sx={{ maxWidth: { xs: "90vw", sm: "400px" } }}>
            {selectedRow && (
              <DialogContentText component="div">
                <p><strong>Customer ID:</strong> {selectedRow.customer_id}</p>
                <p><strong>PPPoE Name:</strong> {selectedRow.PPPoE_Name}</p>
                <p>
                  <strong>Mobile No:</strong>{" "}
                  <Link href={`tel:${selectedRow.client_phone}`} underline="hover" color="primary">
                    {selectedRow.client_phone}
                  </Link>
                </p>
                <p><strong>July:</strong> {selectedRow.July}</p>
                <p><strong>June:</strong> {selectedRow.June}</p>
                <p><strong>May:</strong> {selectedRow.May}</p>
                <p><strong>Count:</strong> {selectedRow.totalCount}</p>
                <p><strong>Total Due:</strong> {selectedRow.balance}</p>
              </DialogContentText>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSelectedRow(null)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}

export default App;


it's ok but not found logout option. plz set logout option in the right top corner.
show area
filter area & blance
