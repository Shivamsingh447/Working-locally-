document.addEventListener("DOMContentLoaded", () => {
  // Sample product data (60 products)
  const products = [
    "Biscuits", "Confectionery", "Juice", "Cookies", "Noodles",
    "Chocolates", "Chips", "Soft Drinks", "Tea", "Coffee",
    "Milk Powder", "Cereal", "Pasta", "Sauce", "Jam",
    "Honey", "Pickles", "Rice", "Flour", "Sugar",
    "Salt", "Spices", "Oil", "Vinegar", "Mayonnaise",
    "Ketchup", "Mustard", "Peanut Butter", "Bread", "Butter",
    "Cheese", "Yogurt", "Ice Cream", "Frozen Vegetables", "Frozen Snacks",
    "Canned Vegetables", "Canned Fruits", "Canned Fish", "Canned Meat", "Bottled Water",
    "Energy Drinks", "Sports Drinks", "Baby Food", "Pet Food", "Cleaning Supplies",
    "Paper Products", "Plastic Ware", "Batteries", "Light Bulbs", "Personal Care",
    "Shampoo", "Soap", "Toothpaste", "Deodorant", "Razors",
    "Vitamins", "Medicines", "First Aid", "Stationery", "Toys"
  ];

  // Pagination variables
  let currentPage = 1;
  const itemsPerPage = 10;
  let filteredProducts = [...products];

  // Records variables
  let recordsCurrentPage = 1;
  const recordsPerPage = 10;
  let allRecords = [];

  // DOM elements
  const inventoryItems = document.getElementById('inventoryItems');
  const prevPageBtn = document.getElementById('prevPage');
  const nextPageBtn = document.getElementById('nextPage');
  const pageInfo = document.getElementById('pageInfo');
  const itemCount = document.getElementById('itemCount');
  const searchInput = document.getElementById('productSearch');
  const entryForm = document.getElementById('entryForm');
  const viewRecords = document.getElementById('viewRecords');
  const navLinks = document.querySelectorAll('.sidebar li');
  const recordsTable = document.getElementById('recordsData');
  const dateFrom = document.getElementById('dateFrom');
  const dateTo = document.getElementById('dateTo');
  const distributorFilter = document.getElementById('distributorFilter');
  const applyFilters = document.getElementById('applyFilters');
  const prevRecords = document.getElementById('prevRecords');
  const nextRecords = document.getElementById('nextRecords');
  const recordsPageInfo = document.getElementById('recordsPageInfo');
  const totalItems = document.getElementById('totalItems');
  const totalPurchases = document.getElementById('totalPurchases');
  const totalSales = document.getElementById('totalSales');

  // Initialize the application
  function init() {
    loadProducts();
    setupEventListeners();
    setupNavigation();
    
    // Set default dates for filters
    const today = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    dateFrom.valueAsDate = oneMonthAgo;
    dateTo.valueAsDate = today;
  }

  // Load products with pagination
  function loadProducts() {
    inventoryItems.innerHTML = '';
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedProducts = filteredProducts.slice(startIndex, endIndex);
    
    paginatedProducts.forEach(product => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${highlightSearchTerm(product)}</td>
        <td><input type="number" name="opening_stock[]" min="0" data-product="${product}"></td>
        <td><input type="number" name="purchase[]" min="0" data-product="${product}"></td>
        <td><input type="number" name="sale[]" min="0" data-product="${product}"></td>
        <td><input type="number" name="closing_stock[]" min="0" readonly data-product="${product}"></td>
      `;
      inventoryItems.appendChild(row);
      
      // Set up event listeners for calculations
      const inputs = row.querySelectorAll('input[type="number"]:not([readonly])');
      inputs.forEach(input => {
        input.addEventListener('input', calculateClosingStock);
      });
    });
    
    updatePaginationInfo();
  }

  // Calculate closing stock
  function calculateClosingStock() {
    const row = this.closest('tr');
    const opening = parseInt(row.querySelector('input[name="opening_stock[]"]').value) || 0;
    const purchase = parseInt(row.querySelector('input[name="purchase[]"]').value) || 0;
    const sale = parseInt(row.querySelector('input[name="sale[]"]').value) || 0;
    const closing = opening + purchase - sale;
    row.querySelector('input[name="closing_stock[]"]').value = closing >= 0 ? closing : 0;
  }

  // Update pagination information
  function updatePaginationInfo() {
    const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    
    const startItem = ((currentPage - 1) * itemsPerPage) + 1;
    const endItem = Math.min(currentPage * itemsPerPage, filteredProducts.length);
    itemCount.textContent = `Showing ${startItem}-${endItem} of ${filteredProducts.length} items`;
    
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;
  }

  // Highlight search term in product names
  function highlightSearchTerm(productName) {
    if (!searchInput.value) return productName;
    
    const regex = new RegExp(searchInput.value, 'gi');
    return productName.replace(regex, match => 
      `<span class="highlight">${match}</span>`
    );
  }

  // Load records from backend
  async function loadRecords() {
    try {
      const response = await fetch('http://localhost:3000/api/records');
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!Array.isArray(data)) {
        throw new Error('Invalid data format received');
      }
      
      // Transform backend data to match frontend structure
      allRecords = data.flatMap(record => 
        record.items.map(item => ({
          date: record.submitted_at || new Date().toISOString().split('T')[0],
          distributor: record.distributor_name,
          town: record.town,
          item: item.item_name,
          opening: item.opening_stock,
          purchase: item.purchase,
          sale: item.sale,
          closing: item.closing_stock
        }))
      );
      
      updateRecordsDisplay();
      populateDistributorFilter();
      updateSummaryStats();
      
    } catch (err) {
      console.error("Error loading records:", err);
      showNotification(`Failed to load records: ${err.message}`, 'error');
      
      // Fallback to empty array
      allRecords = [];
      updateRecordsDisplay();
      populateDistributorFilter();
      updateSummaryStats();
    }
  }

  // Update records display with pagination
  function updateRecordsDisplay() {
    const filtered = filterRecords();
    const startIndex = (recordsCurrentPage - 1) * recordsPerPage;
    const paginatedRecords = filtered.slice(startIndex, startIndex + recordsPerPage);
    
    recordsTable.innerHTML = '';
    paginatedRecords.forEach(record => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${record.date}</td>
        <td>${record.distributor}</td>
        <td>${record.town}</td>
        <td>${record.item}</td>
        <td>${record.opening}</td>
        <td>${record.purchase}</td>
        <td>${record.sale}</td>
        <td>${record.closing}</td>
      `;
      recordsTable.appendChild(row);
    });
    
    updateRecordsPaginationInfo(filtered.length);
    updateSummaryStats(filtered);
  }

  // Filter records based on selected filters
  function filterRecords() {
    let filtered = [...allRecords];
    
    // Date filter
    if (dateFrom.value) {
      filtered = filtered.filter(record => record.date >= dateFrom.value);
    }
    if (dateTo.value) {
      filtered = filtered.filter(record => record.date <= dateTo.value);
    }
    
    // Distributor filter
    if (distributorFilter.value) {
      filtered = filtered.filter(record => record.distributor === distributorFilter.value);
    }
    
    return filtered;
  }

  // Update records pagination info
  function updateRecordsPaginationInfo(totalRecords) {
    const totalPages = Math.ceil(totalRecords / recordsPerPage);
    recordsPageInfo.textContent = `Page ${recordsCurrentPage} of ${totalPages}`;
    
    prevRecords.disabled = recordsCurrentPage === 1;
    nextRecords.disabled = recordsCurrentPage === totalPages || totalPages === 0;
  }

  // Update summary statistics
  function updateSummaryStats(records = allRecords) {
    const totalItems = records.reduce((sum, record) => sum + record.opening + record.purchase, 0);
    const totalPurchase = records.reduce((sum, record) => sum + record.purchase, 0);
    const totalSale = records.reduce((sum, record) => sum + record.sale, 0);
    
    document.getElementById('totalItems').textContent = totalItems.toLocaleString();
    document.getElementById('totalPurchases').textContent = totalPurchase.toLocaleString();
    document.getElementById('totalSales').textContent = totalSale.toLocaleString();
  }

  // Populate distributor filter dropdown
  function populateDistributorFilter() {
    const distributors = [...new Set(allRecords.map(record => record.distributor))];
    distributorFilter.innerHTML = '<option value="">All Distributors</option>';
    
    distributors.forEach(distributor => {
      const option = document.createElement('option');
      option.value = distributor;
      option.textContent = distributor;
      distributorFilter.appendChild(option);
    });
  }

  // Set up event listeners
  function setupEventListeners() {
    // Product pagination
    prevPageBtn.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        loadProducts();
      }
    });
    
    nextPageBtn.addEventListener('click', () => {
      if (currentPage < Math.ceil(filteredProducts.length / itemsPerPage)) {
        currentPage++;
        loadProducts();
      }
    });
    
    // Search functionality
    searchInput.addEventListener('input', () => {
      const searchTerm = searchInput.value.toLowerCase();
      filteredProducts = products.filter(product => 
        product.toLowerCase().includes(searchTerm)
      );
      currentPage = 1;
      loadProducts();
    });
    
    // Records pagination
    prevRecords.addEventListener('click', () => {
      if (recordsCurrentPage > 1) {
        recordsCurrentPage--;
        updateRecordsDisplay();
      }
    });
    
    nextRecords.addEventListener('click', () => {
      const filtered = filterRecords();
      const totalPages = Math.ceil(filtered.length / recordsPerPage);
      
      if (recordsCurrentPage < totalPages) {
        recordsCurrentPage++;
        updateRecordsDisplay();
      }
    });
    
    // Apply filters
    applyFilters.addEventListener('click', () => {
      recordsCurrentPage = 1;
      updateRecordsDisplay();
    });
    
    // Form submission
    document.getElementById("inventoryForm").addEventListener("submit", handleFormSubmit);
  }

  // Set up navigation between sections
  function setupNavigation() {
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        
        if (link.textContent.includes('New Entry')) {
          entryForm.style.display = 'block';
          viewRecords.style.display = 'none';
        } else if (link.textContent.includes('View Records')) {
          entryForm.style.display = 'none';
          viewRecords.style.display = 'block';
          loadRecords(); // Load real data when switching to records view
        }
      });
    });
  }

  // Form submission handler
  async function handleFormSubmit(e) {
    e.preventDefault();

    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

    // Collect distributor info
    const distributorData = {
      distributor_name: form.distributor_name.value,
      town: form.town.value,
      super_stockist: form.super_stockist.value,
      state: form.state.value,
      entered_by: form.entered_by.value,
      mobile: form.mobile.value,
      items: []
    };

    // Collect inventory items
    const rows = form.querySelectorAll('#inventoryTable tbody tr');
    rows.forEach(row => {
      const itemName = row.querySelector('td:first-child').textContent.trim();
      const openingStock = parseInt(row.querySelector('input[name="opening_stock[]"]').value) || 0;
      const purchase = parseInt(row.querySelector('input[name="purchase[]"]').value) || 0;
      const sale = parseInt(row.querySelector('input[name="sale[]"]').value) || 0;
      const closingStock = parseInt(row.querySelector('input[name="closing_stock[]"]').value) || 0;
      
      if (openingStock > 0 || purchase > 0 || sale > 0) {
        distributorData.items.push({
          item_name: itemName,
          opening_stock: openingStock,
          purchase: purchase,
          sale: sale,
          closing_stock: closingStock
        });
      }
    });

    // Validate at least one item has data
    if (distributorData.items.length === 0) {
      showNotification('Please enter data for at least one item', 'error');
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Data';
      return;
    }

    // Send data to server
    try {
      const response = await fetch('http://localhost:3000/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(distributorData)
      });

      if (!response.ok) {
        throw new Error('Failed to submit data');
      }

      const result = await response.json();
      showNotification('Data saved successfully!', 'success');
      form.reset();

      // Reset closing stock calculations
      const closingInputs = form.querySelectorAll('input[name="closing_stock[]"]');
      closingInputs.forEach(input => input.value = '');
      
    } catch (err) {
      console.error("Error submitting form:", err);
      showNotification('Failed to submit form. Please try again.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Data';
    }
  }
  
  // Show notification
  function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
      <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
      <span>${message}</span>
    `;
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // Initialize the application
  init();
});
