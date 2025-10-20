// Import the DOM elements this module needs
import * as D from './dom.js';

export function setActiveMenuItem(menuItem) {
	sidebarMenu.querySelectorAll('li').forEach(item => item.classList.remove('active'));
	if (menuItem) {
		menuItem.classList.add('active');
		const parentContainer = menuItem.closest('.has-submenu');
		if (parentContainer) {
			parentContainer.classList.add('active');
			parentContainer.classList.add('open');
		}
	}
}
export function checkAdminMode() {
	const isAdminPath = window.location.pathname.includes('/admin');
	const adminItems = document.querySelectorAll('.admin-only');
	adminItems.forEach(item => {
		item.style.display = isAdminPath ? 'list-item' : 'none';
	});
}
export function showPage(pageToShow) {
	if (chatPage) chatPage.style.display = 'none';
	if (settingsPage) settingsPage.style.display = 'none';
	if (fileUploadPage) fileUploadPage.style.display = 'none';
	if (emptyStateContainer) emptyStateContainer.style.display = 'none';
	if (docViewerPage) docViewerPage.style.display = 'none';

	if (pageToShow) {
		pageToShow.style.display = (pageToShow === chatPage || pageToShow === emptyStateContainer) ? 'flex' : 'block';
	}
}
export function openSidebar() { document.body.classList.add('sidebar-open'); }
export function closeSidebar() { document.body.classList.remove('sidebar-open'); }
export function closeModal() { detailsModal.style.display = 'none'; }
