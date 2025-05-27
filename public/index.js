document.addEventListener("DOMContentLoaded", () => {
  // DOM elements
  const elements = {
    inventoryItems: document.getElementById('inventoryItems'),
    prevPageBtn: document.getElementById('prevPage'),
    nextPageBtn: document.getElementById('nextPage'),
    pageInfo: document.getElementById('pageInfo'),
    itemCount: document.getElementById('itemCount'),
    searchInput: document.getElementById('productSearch'),
    entryForm: document.getElementById('entryForm'),
    viewRecords: document.getElementById('viewRecords'),
    navLinks: document.querySelectorAll('.sidebar li'),
    recordsTable: document.getElementById('recordsData'),
    dateFrom: document.getElementById('dateFrom'),
    dateTo: document.getElementById('dateTo'),
    distributorFilter: document.getElementById('distributorFilter'),
    applyFilters: document.getElementById('applyFilters'),
    prevRecords: document.getElementById('prevRecords'),
    nextRecords: document.getElementById('nextRecords'),
    recordsPageInfo: document.getElementById('recordsPageInfo'),
    totalItems: document.getElementById('totalItems'),
    totalPurchases: document.getElementById('totalPurchases'),
    totalSales: document.getElementById('totalSales'),
    inventoryForm: document.getElementById('inventoryForm')
  };

  // State
  const state = {
    currentPage: 1,
    itemsPerPage: 10,
    recordsCurrentPage: 1,
    recordsPerPage: 10,
    filteredProducts: [],
    allRecords: [],
    products: [
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
    ]
  };

  // Initialize the application
  async function init() {
    setupEventListeners();
    setupNavigation();
    loadProducts();
    
    // Set default dates for filters
    const today = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    elements.dateFrom.valueAsDate = oneMonthAgo;
    elements.dateTo.valueAsDate = today;
    
    // Load initial records
    await loadRecords();
  }

  // API Functions
  async function loadRecords() {
    try {
      const response = await fetch('/api/records');
      if (!response.ok) throw new Error('Failed to load records');
      
      state.allRecords = await response.json();
      updateRecordsDisplay();
      populateDistributorFilter();
      updateSummaryStats();
    } catch (error) {
      console.error('Error loading records:', error);
      showNotification('Failed to load records. Please try again.', 'error');
    }
  }

  async function applyRecordFilters() {
    try {
      const params = new URLSearchParams();
      if (elements.dateFrom.value) params.append('startDate', elements.dateFrom.value);
      if (elements.dateTo.value) params.append('endDate', elements.dateTo.value);
      if (elements.distributorFilter.value) params.append('distributor', elements.distributorFilter.value);
      
      const response = await fetch(`/api/records/filter?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to filter records');
      
      state.allRecords = await response.json();
      state.recordsCurrentPage = 1;
      updateRecordsDisplay();
      updateSummaryStats();
    } catch (error) {
      console.error('Error filtering records:', error);
      showNotification('Failed to filter records. Please try again.', 'error');
    }
  }

  // UI Functions
  function loadProducts() {
    elements.inventoryItems.innerHTML = '';
    
    const startIndex = (state.currentPage - 1) * state.itemsPerPage;
    const endIndex = startIndex + state.itemsPerPage;
    const paginatedProducts = state.filteredProducts.slice(startIndex, endIndex);
    
    paginatedProducts.forEach(product => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${highlightSearchTerm(product)}</td>
        <td><input type="number" name="opening_stock[]" min="0" data-product="${product}"></td>
        <td><input type="number" name="purchase[]" min="0" data-product="${product}"></td>
        <td><input type="number" name="sale[]" min="0" data-product="${product}"></td>
        <td><input type="number" name="closing_stock[]" min="0" readonly data-product="${product}"></td>
      `;
      elements.inventoryItems.appendChild(row);
      
      // Set up event listeners for calculations
      const inputs = row.querySelectorAll('input[type="number"]:not([readonly])');
      inputs.forEach(input => {
        input.addEventListener('input', calculateClosingStock);
      });
    });
    
    updatePaginationInfo();
  }

  function calculateClosingStock() {
    const row = this.closest('tr');
    const opening = parseInt(row.querySelector('input[name="opening_stock[]"]').value) || 0;
    const purchase = parseInt(row.querySelector('input[name="purchase[]"]').value) || 0;
    const sale = parseInt(row.querySelector('input[name="sale[]"]').value) || 0;
    const closing = opening + purchase - sale;
    row.querySelector('input[name="closing_stock[]"]').value = closing >= 0 ? closing : 0;
  }

  function updatePaginationInfo() {
    const totalPages = Math.ceil(state.filteredProducts.length / state.itemsPerPage);
    elements.pageInfo.textContent = `Page ${state.currentPage} of ${totalPages}`;
    
    const startItem = ((state.currentPage - 1) * state.itemsPerPage) + 1;
    const endItem = Math.min(state.currentPage * state.itemsPerPage, state.filteredProducts.length);
    elements.itemCount.textContent = `Showing ${startItem}-${endItem} of ${state.filteredProducts.length} items`;
    
    elements.prevPageBtn.disabled = state.currentPage === 1;
    elements.nextPageBtn.disabled = state.currentPage === totalPages;
  }

  function highlightSearchTerm(productName) {
    if (!elements.searchInput.value) return productName;
    
    const regex = new RegExp(elements.searchInput.value, 'gi');
    return productName.replace(regex, match => 
      `<span class="highlight">${match}</span>`
    );
  }

  function updateRecordsDisplay() {
    const startIndex = (state.recordsCurrentPage - 1) * state.recordsPerPage;
    const paginatedRecords = state.allRecords.slice(startIndex, startIndex + state.recordsPerPage);
    
    elements.recordsTable.innerHTML = '';
    paginatedRecords.forEach(record => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${new Date(record.submitted_at).toLocaleDateString()}</td>
        <td>${record.distributor_name}</td>
        <td>${record.town}</td>
        <td>${record.items.map(item => item.item_name).join(', ')}</td>
        <td>${record.items.reduce((sum, item) => sum + item.opening_stock, 0)}</td>
        <td>${record.items.reduce((sum, item) => sum + item.purchase, 0)}</td>
        <td>${record.items.reduce((sum, item) => sum + item.sale, 0)}</td>
        <td>${record.items.reduce((sum, item) => sum + item.closing_stock, 0)}</td>
      `;
      elements.recordsTable.appendChild(row);
    });
    
    updateRecordsPaginationInfo();
    updateSummaryStats();
  }

  function updateRecordsPaginationInfo() {
    const totalPages = Math.ceil(state.allRecords.length / state.recordsPerPage);
    elements.recordsPageInfo.textContent = `Page ${state.recordsCurrentPage} of ${totalPages}`;
    
    elements.prevRecords.disabled = state.recordsCurrentPage === 1;
    elements.nextRecords.disabled = state.recordsCurrentPage === totalPages || totalPages === 0;
  }

  function updateSummaryStats() {
    const totalItems = state.allRecords.reduce((sum, record) => 
      sum + record.items.reduce((itemSum, item) => itemSum + item.opening_stock + item.purchase, 0), 0);
    const totalPurchase = state.allRecords.reduce((sum, record) => 
      sum + record.items.reduce((itemSum, item) => itemSum + item.purchase, 0), 0);
    const totalSale = state.allRecords.reduce((sum, record) => 
      sum + record.items.reduce((itemSum, item) => itemSum + item.sale, 0), 0);
    
    elements.totalItems.textContent = totalItems.toLocaleString();
    elements.totalPurchases.textContent = totalPurchase.toLocaleString();
    elements.totalSales.textContent = totalSale.toLocaleString();
  }

  function populateDistributorFilter() {
    const distributors = [...new Set(state.allRecords.map(record => record.distributor_name))];
    elements.distributorFilter.innerHTML = '<option value="">All Distributors</option>';
    
    distributors.forEach(distributor => {
      const option = document.createElement('option');
      option.value = distributor;
      option.textContent = distributor;
      elements.distributorFilter.appendChild(option);
    });
  }

  // Event Handlers
  async function handleFormSubmit(e) {
    e.preventDefault();
    const submitBtn = elements.inventoryForm.querySelector('button[type="submit"]');
    
    try {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

      // Collect distributor info
      const distributorData = {
        distributor_name: elements.inventoryForm.distributor_name.value,
        town: elements.inventoryForm.town.value,
        super_stockist: elements.inventoryForm.super_stockist.value || null,
        state: elements.inventoryForm.state.value,
        entered_by: elements.inventoryForm.entered_by.value || null,
        mobile: elements.inventoryForm.mobile.value,
        items: []
      };

      // Collect inventory items
      const rows = elements.inventoryForm.querySelectorAll('#inventoryTable tbody tr');
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
        throw new Error('Please enter data for at least one item');
      }

      // Submit to backend
      const response = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(distributorData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Submission failed');
      }

      const result = await response.json();
      showNotification(result.message, 'success');
      elements.inventoryForm.reset();
      
      // Reset closing stock calculations
      const closingInputs = elements.inventoryForm.querySelectorAll('input[name="closing_stock[]"]');
      closingInputs.forEach(input => input.value = '');
      
      // Refresh records
      await loadRecords();
    } catch (error) {
      console.error("Submission error:", error);
      showNotification(error.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Submit Data';
    }
  }

  function setupEventListeners() {
    // Product pagination
    elements.prevPageBtn.addEventListener('click', () => {
      if (state.currentPage > 1) {
        state.currentPage--;
        loadProducts();
      }
    });
    
    elements.nextPageBtn.addEventListener('click', () => {
      if (state.currentPage < Math.ceil(state.filteredProducts.length / state.itemsPerPage)) {
        state.currentPage++;
        loadProducts();
      }
    });
    
    // Search functionality
    elements.searchInput.addEventListener('input', () => {
      const searchTerm = elements.searchInput.value.toLowerCase();
      state.filteredProducts = state.products.filter(product => 
        product.toLowerCase().includes(searchTerm)
      );
      state.currentPage = 1;
      loadProducts();
    });
    
    // Records pagination
    elements.prevRecords.addEventListener('click', () => {
      if (state.recordsCurrentPage > 1) {
        state.recordsCurrentPage--;
        updateRecordsDisplay();
      }
    });
    
    elements.nextRecords.addEventListener('click', () => {
      const totalPages = Math.ceil(state.allRecords.length / state.recordsPerPage);
      if (state.recordsCurrentPage < totalPages) {
        state.recordsCurrentPage++;
        updateRecordsDisplay();
      }
    });
    
    // Apply filters
    elements.applyFilters.addEventListener('click', applyRecordFilters);
    
    // Form submission
    elements.inventoryForm.addEventListener("submit", handleFormSubmit);
  }

  function setupNavigation() {
    elements.navLinks.forEach(link => {
      link.addEventListener('click', () => {
        elements.navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        
        if (link.textContent.includes('New Entry')) {
          elements.entryForm.style.display = 'block';
          elements.viewRecords.style.display = 'none';
        } else if (link.textContent.includes('View Records')) {
          elements.entryForm.style.display = 'none';
          elements.viewRecords.style.display = 'block';
        }
      });
    });
  }

  function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
      <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
      <span>${message}</span>
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  // Initialize
  state.filteredProducts = [...state.products];
  init();
});