// Global variables
let currentUser = null;
let cartItems = [];

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    checkAuthStatus();
    loadFeaturedProducts();
    loadCartCount();
    setupEventListeners();
});

// Check if user is authenticated
async function checkAuthStatus() {
    try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            updateNavigation();
        }
    } catch (error) {
        console.error('Auth check error:', error);
    }
}

// Update navigation based on auth status
function updateNavigation() {
    const loginLink = document.getElementById('loginLink');
    const loginText = document.getElementById('loginText');
    
    if (currentUser) {
        loginText.textContent = currentUser.username;
        loginLink.href = '/dashboard';
        
        // Add logout option
        loginLink.addEventListener('click', function(e) {
            e.preventDefault();
            showLogoutMenu();
        });
    } else {
        loginText.textContent = 'Log In';
        loginLink.href = '/login';
    }
}

// Show logout menu
function showLogoutMenu() {
    const menu = document.createElement('div');
    menu.className = 'logout-menu';
    menu.innerHTML = `
        <div style="position: absolute; top: 60px; right: 20px; background: white; border: 1px solid #ccc; border-radius: 5px; padding: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); z-index: 1001;">
            <a href="/dashboard" style="display: block; padding: 5px 10px; color: #333; text-decoration: none;">Dashboard</a>
            <a href="#" onclick="logout()" style="display: block; padding: 5px 10px; color: #333; text-decoration: none;">Logout</a>
        </div>
    `;
    
    document.body.appendChild(menu);
    
    // Remove menu when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
            }
        });
    }, 100);
}

// Logout function
async function logout() {
    try {
        const response = await fetch('/api/auth/logout', {
            method: 'POST'
        });
        
        if (response.ok) {
            currentUser = null;
            updateNavigation();
            window.location.href = '/';
        }
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Load featured products
async function loadFeaturedProducts() {
    try {
        const response = await fetch('/api/products/featured/list');
        if (response.ok) {
            const products = await response.json();
            displayFeaturedProducts(products);
        }
    } catch (error) {
        console.error('Load featured products error:', error);
    }
}

// Display featured products
function displayFeaturedProducts(products) {
    const container = document.getElementById('featuredProducts');
    if (!container) return;
    
    container.innerHTML = products.map(product => `
        <div class="product fade-in" onclick="viewProduct(${product.id})">
            <img src="${getProductImage(product.image)}" alt="${product.name}">
            <h3>${product.name}</h3>
            <p>$${parseFloat(product.price).toFixed(2)}</p>
            <button class="add-to-cart-btn" onclick="event.stopPropagation(); addToCart(${product.id})">
                Add to Cart
            </button>
        </div>
    `).join('');
}

// Get product image URL
function getProductImage(imageName) {
    if (!imageName) return 'https://via.placeholder.com/300x300?text=No+Image';
    if (imageName.startsWith('http')) return imageName;
    if (imageName.includes('.jpg') || imageName.includes('.png')) {
        return `./images/${imageName}`;
    }
    return `/uploads/${imageName}`;
}

// View product details
function viewProduct(productId) {
    window.location.href = `/shop?product=${productId}`;
}

// Add to cart
async function addToCart(productId, quantity = 1) {
    if (!currentUser) {
        alert('Please login to add items to cart');
        window.location.href = '/login';
        return;
    }
    
    try {
        const response = await fetch('/api/cart/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                product_id: productId,
                quantity: quantity
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showNotification('Item added to cart successfully!', 'success');
            loadCartCount();
        } else {
            showNotification(data.error || 'Failed to add item to cart', 'error');
        }
    } catch (error) {
        console.error('Add to cart error:', error);
        showNotification('Failed to add item to cart', 'error');
    }
}

// Load cart count
async function loadCartCount() {
    if (!currentUser) return;
    
    try {
        const response = await fetch('/api/cart');
        if (response.ok) {
            const data = await response.json();
            document.getElementById('cartCount').textContent = data.count;
        }
    } catch (error) {
        console.error('Load cart count error:', error);
    }
}

// Search products
function searchProducts() {
    const searchTerm = document.getElementById('searchInput').value.trim();
    if (searchTerm) {
        window.location.href = `/shop?search=${encodeURIComponent(searchTerm)}`;
    }
}

// Filter by category
function filterByCategory(categoryName) {
    window.location.href = `/shop?category_name=${encodeURIComponent(categoryName)}`;
}

// Setup event listeners
function setupEventListeners() {
    // Search on Enter key
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchProducts();
            }
        });
    }
    
    // Newsletter form
    const newsletterForm = document.getElementById('newsletter-form');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', function(e) {
            e.preventDefault();
            showNotification('Thank you for subscribing to our newsletter!', 'success');
            this.reset();
        });
    }
}

// Show notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 5px;
        color: white;
        font-weight: bold;
        z-index: 1000;
        animation: slideInRight 0.3s ease;
    `;
    
    switch(type) {
        case 'success':
            notification.style.backgroundColor = '#4CAF50';
            break;
        case 'error':
            notification.style.backgroundColor = '#f44336';
            break;
        default:
            notification.style.backgroundColor = '#2196F3';
    }
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Add CSS for notification animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .logout-menu {
        position: relative;
    }
`;
document.head.appendChild(style);