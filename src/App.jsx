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
} from "@mui/material";
import { styled } from "@mui/material/styles";

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  fontWeight: 600,
  color: theme.palette.primary.contrastText,
  backgroundColor: theme.palette.primary.main,
}));

const AnimatedRow = styled(TableRow)(({ theme }) => ({
  transition: "all 0.3s ease",
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

function App() {
  const [results, setResults] = useState([]);
  const [filteredResults, setFilteredResults] = useState([]);
  const [filter, setFilter] = useState({ July: "", June: "", May: "" });
  const [summary, setSummary] = useState({ July: 0, June: 0, May: 0 });

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

      const final = sheet1.map((row) => {
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
          balance: balance.toFixed(2),
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
  };

  useEffect(() => {
    handleLoadData();
  }, []);

  return (
    <Box sx={{ p: 3, bgcolor: "#f5f8fc", minHeight: "100vh" }}>
      <Typography variant="h4" align="center" gutterBottom fontWeight={700}>
        Customer Based No Payment History
      </Typography>
      <Box display="flex" gap={2} justifyContent="center" flexWrap="wrap" mb={2}>
        {["July", "June", "May"].map((month) => (
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

      <Box display="flex" justifyContent="center" gap={4} mb={2}>
        <Typography variant="subtitle1">July No Payment: {summary.July}</Typography>
        <Typography variant="subtitle1">June No Payment: {summary.June}</Typography>
        <Typography variant="subtitle1">May No Payment: {summary.May}</Typography>
      </Box>

      <TableContainer component={Paper} sx={{ maxWidth: 1000, mx: "auto" }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
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
            {filteredResults.map((row, idx) => (
              <Fade in timeout={300 + idx * 50} key={idx}>
                <AnimatedRow>
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
      </TableContainer>
    </Box>
  );
}

export default App;
