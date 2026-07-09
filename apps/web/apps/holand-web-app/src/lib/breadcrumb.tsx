'use client';
import React from 'react';

interface ItemProps { href?: string; children: React.ReactNode }
function Item({ href, children }: ItemProps) {
  return href
    ? <a href={href} className="text-sm text-gray-500 hover:text-gray-900">{children}</a>
    : <span className="text-sm text-gray-500">{children}</span>;
}

interface BreadcrumbProps {
  separator?: string;
  separatorVariant?: string;
  className?: string;
  children?: React.ReactNode;
}
function Breadcrumb({ className, children }: BreadcrumbProps) {
  const items = React.Children.toArray(children);
  return (
    <nav className={`flex items-center gap-1 ${className ?? ''}`}>
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-gray-300">·</span>}
          {item}
        </React.Fragment>
      ))}
    </nav>
  );
}
Breadcrumb.Item = Item;
export default Breadcrumb;
