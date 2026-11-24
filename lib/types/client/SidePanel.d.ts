import React from 'react';
/** A view-local modal drawer. It changes no routing, membership or request ownership. */
export declare function SidePanel(props: {
    title: string;
    closeLabel: string;
    onClose: () => void;
    busy?: boolean;
    children: React.ReactNode;
}): React.ReactElement;
